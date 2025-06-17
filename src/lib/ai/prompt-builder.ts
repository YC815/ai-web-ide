// 動態 Prompt 構建器 - 每次對話都重新生成完整的系統提示詞
import { SYSTEM_PROMPTS, INTENT_KEYWORDS, PromptGenerator } from './prompts';
import { ProjectSnapshot } from './context-manager';

export interface ConversationContext {
  projectSnapshot?: ProjectSnapshot;
  conversationHistory: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
  }>;
  lastError?: string;
  currentIntent?: string;
}

export interface PromptBuildOptions {
  includeProjectContext: boolean;
  includeConversationHistory: boolean;
  maxHistoryLength: number;
  includeToolGuidance: boolean;
  includeErrorContext: boolean;
}

export class DynamicPromptBuilder {
  private defaultOptions: PromptBuildOptions = {
    includeProjectContext: true,
    includeConversationHistory: true,
    maxHistoryLength: 10,
    includeToolGuidance: true,
    includeErrorContext: true
  };

  /**
   * 為每個新訊息構建完整的系統提示詞
   */
  buildCompletePrompt(
    userMessage: string,
    context: ConversationContext,
    options: Partial<PromptBuildOptions> = {}
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    
    let prompt = '';

    // 1. 基礎系統提示詞
    prompt += this.buildSystemPrompt();
    prompt += '\n\n';

    // 2. 專案上下文
    if (opts.includeProjectContext && context.projectSnapshot) {
      prompt += this.buildProjectContextPrompt(context.projectSnapshot);
      prompt += '\n\n';
    }

    // 3. 工具選擇指導
    if (opts.includeToolGuidance) {
      const intent = this.analyzeUserIntent(userMessage);
      prompt += this.buildToolGuidancePrompt(intent, context.projectSnapshot);
      prompt += '\n\n';
    }

    // 4. 對話歷史上下文
    if (opts.includeConversationHistory && context.conversationHistory.length > 0) {
      prompt += this.buildConversationHistoryPrompt(context.conversationHistory, opts.maxHistoryLength);
      prompt += '\n\n';
    }

    // 5. 錯誤上下文
    if (opts.includeErrorContext && context.lastError) {
      prompt += this.buildErrorContextPrompt(context.lastError);
      prompt += '\n\n';
    }

    // 6. 當前任務指示
    prompt += this.buildCurrentTaskPrompt(userMessage, context);

    return prompt;
  }

  /**
   * 構建基礎系統提示詞
   */
  private buildSystemPrompt(): string {
    return `${SYSTEM_PROMPTS.MAIN_SYSTEM}

${SYSTEM_PROMPTS.TOOL_SELECTION_GUIDE}

${SYSTEM_PROMPTS.RESPONSE_FORMAT_GUIDE}`;
  }

  /**
   * 構建專案上下文提示詞
   */
  private buildProjectContextPrompt(projectSnapshot: ProjectSnapshot): string {
    const contextPrompt = PromptGenerator.generateContextPrompt(projectSnapshot);
    
    return `## 📋 當前專案上下文

${contextPrompt}

**專案詳細資訊：**
- **檔案結構**：${projectSnapshot.fileStructure.files.length} 個檔案
  主要目錄：${projectSnapshot.fileStructure.directories.slice(0, 5).join(', ')}
  
- **關鍵檔案**：${Object.keys(projectSnapshot.fileStructure.keyFiles).join(', ')}

- **依賴狀況**：
  * 生產依賴：${Object.keys(projectSnapshot.dependencies.dependencies).slice(0, 5).join(', ')}
  * 開發依賴：${Object.keys(projectSnapshot.dependencies.devDependencies).slice(0, 5).join(', ')}

${projectSnapshot.gitStatus ? `- **Git 狀態**：${projectSnapshot.gitStatus.branch} 分支，${projectSnapshot.gitStatus.hasChanges ? '有未提交變更' : '無變更'}` : ''}

${projectSnapshot.buildStatus ? `- **建置狀態**：${projectSnapshot.buildStatus.canBuild ? '可建置' : '有錯誤'}` : ''}`;
  }

  /**
   * 構建工具選擇指導提示詞
   */
  private buildToolGuidancePrompt(intent: string, projectSnapshot?: ProjectSnapshot): string {
    const guidancePrompt = PromptGenerator.generateGuidancePrompt(intent);
    
    let toolGuidance = `## 🛠️ 工具選擇指導

**檢測到的用戶意圖**：${intent}

${guidancePrompt}

**可用工具清單：**
1. **AIContextManager** - 專案狀態分析
   - getProjectSnapshot() - 獲取完整專案快照
   - generateAIProjectReport() - 生成專案報告
   - getSmartSuggestions() - 獲取智能建議

2. **FileSystemTool** - 檔案操作
   - readFile(path) - 讀取檔案內容
   - writeFile(path, content) - 寫入檔案
   - createFile(path, content) - 創建新檔案
   - deleteFile(path) - 刪除檔案
   - listDirectory(path) - 列出目錄內容

3. **CommandExecutionTool** - 命令執行
   - npmCommand(args) - 執行 npm 命令
   - gitCommand(args) - 執行 git 命令
   - executeCommand(cmd, args) - 執行任意命令

4. **ProjectManagementTool** - 專案管理
   - initializeProject() - 初始化 Next.js 專案
   - getProjectStatus() - 獲取專案狀態
   - getProjectStructure() - 獲取檔案結構

5. **AIToolkit** - 高級操作
   - ensureProjectInitialized() - 確保專案已初始化
   - createReactComponent(name, code) - 創建 React 組件
   - deployAndPreview() - 部署與預覽`;

    // 根據專案狀態添加特定建議
    if (projectSnapshot) {
      if (!projectSnapshot.projectInfo.isInitialized) {
        toolGuidance += `\n\n⚠️ **注意**：專案尚未初始化，建議先使用 initializeProject()`;
      }
      
      if (projectSnapshot.buildStatus && !projectSnapshot.buildStatus.canBuild) {
        toolGuidance += `\n\n🚨 **警告**：專案無法建置，可能需要修復錯誤`;
      }
    }

    return toolGuidance;
  }

  /**
   * 構建對話歷史上下文提示詞
   */
  private buildConversationHistoryPrompt(
    history: ConversationContext['conversationHistory'], 
    maxLength: number
  ): string {
    const recentHistory = history.slice(-maxLength);
    
    let historyPrompt = `## 💬 對話歷史上下文\n\n`;
    
    recentHistory.forEach((msg) => {
      const role = msg.role === 'user' ? '👤 用戶' : '🤖 助理';
      historyPrompt += `**${role}**：${msg.content}\n\n`;
    });

    // 分析對話模式
    const userMessages = recentHistory.filter(msg => msg.role === 'user');
    const lastUserIntent = userMessages.length > 0 ? 
      this.analyzeUserIntent(userMessages[userMessages.length - 1].content) : 'unknown';

    historyPrompt += `**對話分析**：
- 最近 ${recentHistory.length} 條訊息
- 主要意圖模式：${lastUserIntent}
- 建議保持對話連貫性和上下文感知`;

    return historyPrompt;
  }

  /**
   * 構建錯誤上下文提示詞
   */
  private buildErrorContextPrompt(lastError: string): string {
    const errorPrompt = PromptGenerator.generateErrorPrompt(lastError);
    
    return `## 🚨 錯誤上下文

${errorPrompt}

**重要**：請根據錯誤資訊調整策略，提供具體的解決方案。`;
  }

  /**
   * 構建當前任務提示詞
   */
  private buildCurrentTaskPrompt(userMessage: string, context: ConversationContext): string {
    const intent = this.analyzeUserIntent(userMessage);
    
    return `## 🎯 當前任務

**用戶訊息**：${userMessage}

**分析結果**：
- 檢測意圖：${intent}
- 需要專案上下文：${this.needsProjectContext(userMessage) ? '是' : '否'}
- 建議操作：${this.suggestActions(intent, context)}

**執行指示**：
1. 根據用戶意圖選擇適當的工具組合
2. 如需專案資訊但缺少上下文，先獲取專案快照
3. 執行操作並提供詳細回饋
4. 根據結果提供下一步建議
5. 保持友善和專業的溝通風格

**回應要求**：
- 使用繁體中文
- 結構化展示資訊
- 提供具體可執行的建議
- 說明執行的動作和原因`;
  }

  /**
   * 分析用戶意圖
   */
  private analyzeUserIntent(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()))) {
        return intent.toLowerCase().replace('_', ' ');
      }
    }
    
    return 'general inquiry';
  }

  /**
   * 判斷是否需要專案上下文
   */
  private needsProjectContext(message: string): boolean {
    const contextKeywords = [
      '專案', '檔案', '結構', '狀態', '目前', '有哪些',
      '創建', '修改', '建立', '初始化', '建置'
    ];
    
    return contextKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * 建議執行動作
   */
  private suggestActions(intent: string, context: ConversationContext): string {
    const suggestions: Record<string, string> = {
      'project exploration': '使用 getProjectSnapshot() 獲取專案狀態，然後生成詳細報告',
      'file operations': '先檢查專案狀態，然後執行相應的檔案操作',
      'development tasks': '確保專案已初始化，分析需求後執行開發任務',
      'project management': '使用專案管理工具執行相應操作',
      'help requests': '提供工具使用指南和操作建議'
    };
    
    // 根據上下文調整建議
    const baseSuggestion = suggestions[intent] || '分析用戶需求，選擇適當的工具組合';
    
    // 如果有錯誤上下文，優先處理錯誤
    if (context.lastError) {
      return `先處理之前的錯誤：${context.lastError.substring(0, 50)}...，然後${baseSuggestion}`;
    }
    
    // 如果沒有專案快照但需要專案上下文，建議先獲取
    if (!context.projectSnapshot && ['project exploration', 'file operations', 'development tasks'].includes(intent)) {
      return `先獲取專案快照以了解當前狀態，然後${baseSuggestion}`;
    }
    
    return baseSuggestion;
  }

  /**
   * 快速構建簡化提示詞（用於性能敏感場景）
   */
  buildSimplifiedPrompt(userMessage: string, projectSnapshot?: ProjectSnapshot): string {
    let prompt = SYSTEM_PROMPTS.MAIN_SYSTEM + '\n\n';
    
    if (projectSnapshot) {
      prompt += PromptGenerator.generateContextPrompt(projectSnapshot) + '\n\n';
    }
    
    const intent = this.analyzeUserIntent(userMessage);
    prompt += PromptGenerator.generateGuidancePrompt(intent) + '\n\n';
    
    prompt += `**當前任務**：${userMessage}\n\n`;
    prompt += `請根據用戶需求選擇適當的工具並執行操作。`;
    
    return prompt;
  }
}

// 工廠函數
export function createDynamicPromptBuilder(): DynamicPromptBuilder {
  return new DynamicPromptBuilder();
}

// 使用範例
export const DYNAMIC_PROMPT_USAGE_GUIDE = `
# 動態 Prompt 構建器使用指南

## 🎯 核心概念

每次用戶發送新訊息時，都重新構建完整的系統提示詞，確保 AI 獲得：
- 最新的專案狀態
- 完整的工具選擇指導
- 相關的對話歷史
- 錯誤上下文（如有）
- 明確的任務指示

## 🚀 基本使用

\`\`\`typescript
const promptBuilder = createDynamicPromptBuilder();

// 構建完整提示詞
const fullPrompt = promptBuilder.buildCompletePrompt(
  userMessage,
  {
    projectSnapshot: currentSnapshot,
    conversationHistory: chatHistory,
    lastError: lastErrorMessage,
    currentIntent: detectedIntent
  }
);

// 發送給 AI
const aiResponse = await sendToAI(fullPrompt);
\`\`\`

## ⚡ 性能優化

對於性能敏感場景，可使用簡化版本：

\`\`\`typescript
const simplifiedPrompt = promptBuilder.buildSimplifiedPrompt(
  userMessage,
  projectSnapshot
);
\`\`\`

## 🎛️ 自定義選項

\`\`\`typescript
const customPrompt = promptBuilder.buildCompletePrompt(
  userMessage,
  context,
  {
    includeProjectContext: true,
    includeConversationHistory: false,  // 跳過歷史
    maxHistoryLength: 5,               // 限制歷史長度
    includeToolGuidance: true,
    includeErrorContext: true
  }
);
\`\`\`

這樣每次對話 AI 都能獲得最完整、最新的上下文！
`; 