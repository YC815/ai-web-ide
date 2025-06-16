// AI 專案助理 - 整合所有AI工具，讓AI智能地探索和管理專案
import { createAIContextManager, ProjectContext, ProjectSnapshot } from '../../../lib/ai-context-manager';
import { createAIToolkit, AIToolkit } from '../../../lib/ai-tools';
import { 
  DynamicPromptBuilder, 
  createDynamicPromptBuilder, 
  ConversationContext 
} from '../../../lib/dynamic-prompt-builder';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  projectContext?: ProjectSnapshot;
}

export interface AIAssistantResponse {
  message: string;
  projectReport?: string;
  suggestions?: string[];
  actionsTaken?: string[];
  needsUserInput?: boolean;
  error?: string;
}

// AI專案助理核心類
export class AIProjectAssistant {
  private contextManager: ReturnType<typeof createAIContextManager>;
  private toolkit: AIToolkit;
  private conversationHistory: ChatMessage[] = [];
  private promptBuilder: DynamicPromptBuilder;
  private lastError?: string;

  constructor(private projectContext: ProjectContext) {
    this.contextManager = createAIContextManager(projectContext);
    this.toolkit = createAIToolkit(projectContext);
    this.promptBuilder = createDynamicPromptBuilder();
  }

  /**
   * 處理用戶訊息並產生智能回應
   */
  async processUserMessage(userMessage: string): Promise<AIAssistantResponse> {
    try {
      // 1. 記錄用戶訊息
      this.addToHistory({
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString()
      });

      // 2. 獲取當前專案快照
      const snapshotResult = await this.contextManager.getProjectSnapshot();
      const projectSnapshot = snapshotResult.success ? snapshotResult.data : undefined;

      // 3. 構建完整的對話上下文
      const conversationContext: ConversationContext = {
        projectSnapshot,
        conversationHistory: this.conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        })),
        lastError: this.lastError,
        currentIntent: this.analyzeUserIntent(userMessage).type
      };

      // 4. 為每個新訊息構建完整的系統提示詞
      const fullPrompt = this.promptBuilder.buildCompletePrompt(
        userMessage,
        conversationContext
      );

      console.log('🤖 為AI構建的完整提示詞長度:', fullPrompt.length);
      console.log('📋 包含的上下文:', {
        hasProjectSnapshot: !!projectSnapshot,
        historyLength: conversationContext.conversationHistory.length,
        hasError: !!this.lastError,
        intent: conversationContext.currentIntent
      });

      // 5. 分析用戶意圖
      const intent = this.analyzeUserIntent(userMessage);
      
      // 6. 根據意圖執行相應動作
      let response: AIAssistantResponse;
      
      switch (intent.type) {
        case 'project_exploration':
          response = await this.handleProjectExploration();
          break;
          
        case 'file_operation':
          response = await this.handleFileOperation(intent.details);
          break;
          
        case 'development_task':
          response = await this.handleDevelopmentTask(intent.details);
          break;
          
        case 'project_status':
          response = await this.handleProjectStatus();
          break;
          
        case 'general_help':
          response = await this.handleGeneralHelp(userMessage);
          break;
          
        default:
          response = await this.handleDefaultResponse(userMessage);
      }

      // 7. 記錄AI回應
      this.addToHistory({
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
        projectContext: projectSnapshot
      });

      // 8. 清除錯誤狀態（如果操作成功）
      if (!response.error) {
        this.lastError = undefined;
      }

      return response;

    } catch (error) {
      const errorMessage = `處理訊息時發生錯誤: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      // 記錄錯誤以供下次對話參考
      this.lastError = errorMessage;
      
      return {
        message: errorMessage,
        error: errorMessage,
        needsUserInput: false
      };
    }
  }

  /**
   * 分析用戶意圖
   */
  private analyzeUserIntent(message: string): {type: string, details: { message?: string }} {
    const lowerMessage = message.toLowerCase();
    
    // 專案探索相關關鍵字
    if (lowerMessage.includes('專案') || lowerMessage.includes('檔案') || 
        lowerMessage.includes('結構') || lowerMessage.includes('目前') ||
        lowerMessage.includes('有哪些') || lowerMessage.includes('狀態')) {
      return { type: 'project_exploration', details: {} };
    }
    
    // 檔案操作相關
    if (lowerMessage.includes('創建') || lowerMessage.includes('建立') ||
        lowerMessage.includes('新增') || lowerMessage.includes('修改') ||
        lowerMessage.includes('刪除') || lowerMessage.includes('讀取')) {
      return { type: 'file_operation', details: { message } };
    }
    
    // 開發任務相關
    if (lowerMessage.includes('組件') || lowerMessage.includes('component') ||
        lowerMessage.includes('頁面') || lowerMessage.includes('功能') ||
        lowerMessage.includes('api') || lowerMessage.includes('樣式')) {
      return { type: 'development_task', details: { message } };
    }
    
    // 專案狀態相關
    if (lowerMessage.includes('初始化') || lowerMessage.includes('建置') ||
        lowerMessage.includes('部署') || lowerMessage.includes('測試') ||
        lowerMessage.includes('git') || lowerMessage.includes('依賴')) {
      return { type: 'project_status', details: {} };
    }
    
    // 一般幫助
    if (lowerMessage.includes('幫助') || lowerMessage.includes('help') ||
        lowerMessage.includes('怎麼') || lowerMessage.includes('如何')) {
      return { type: 'general_help', details: { message } };
    }
    
    return { type: 'default', details: { message } };
  }

  /**
   * 處理專案探索請求
   */
  private async handleProjectExploration(): Promise<AIAssistantResponse> {
    try {
      console.log('🔍 AI開始探索專案...');
      
      // 獲取專案快照
      const snapshotResult = await this.contextManager.getProjectSnapshot(true);
      
      if (!snapshotResult.success) {
        return {
          message: `❌ 無法探索專案: ${snapshotResult.error}`,
          error: snapshotResult.error,
          needsUserInput: false
        };
      }

      // 生成專案報告
      const report = await this.contextManager.generateAIProjectReport();
      
      // 獲取智能建議
      const suggestionsResult = await this.contextManager.getSmartSuggestions();
      
      const actionsTaken = [
        '✅ 掃描專案檔案結構',
        '✅ 分析關鍵配置檔案',
        '✅ 檢查專案依賴關係',
        '✅ 評估專案狀態',
        '✅ 生成智能建議'
      ];

      return {
        message: '🎯 我已經完成專案探索！以下是詳細的專案分析報告：',
        projectReport: report,
        suggestions: suggestionsResult.data || [],
        actionsTaken: actionsTaken,
        needsUserInput: false
      };

    } catch (error) {
      return {
        message: `探索專案時發生錯誤: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
        needsUserInput: false
      };
    }
  }

  /**
   * 處理檔案操作請求
   */
  private async handleFileOperation(details: { message?: string }): Promise<AIAssistantResponse> {
    
    // 先獲取專案狀態以確保上下文
    await this.contextManager.getProjectSnapshot();
    
    // 如果有具體的檔案操作訊息，可以在這裡處理
    const operationHint = details.message ? `\n\n您提到：${details.message}` : '';
    
    return {
      message: `📁 我了解您想進行檔案操作。讓我先確保專案已經初始化，然後為您處理。${operationHint}`,
      actionsTaken: [
        '🔍 檢查專案狀態',
        '📋 準備執行檔案操作'
      ],
      needsUserInput: true  // 需要更具體的指示
    };
  }

  /**
   * 處理開發任務請求
   */
  private async handleDevelopmentTask(details: { message?: string }): Promise<AIAssistantResponse> {
    
    // 確保專案已初始化
    const initResult = await this.toolkit.ensureProjectInitialized();
    
    if (!initResult.success) {
      return {
        message: '❌ 專案尚未初始化，無法執行開發任務。我可以幫您先初始化專案嗎？',
        error: initResult.error,
        needsUserInput: true
      };
    }

    // 如果有具體的開發任務訊息，可以在這裡處理
    const taskHint = details.message ? `\n\n您提到：${details.message}` : '';

    return {
      message: `🚀 專案已準備就緒！我可以幫您創建組件、頁面或其他開發任務。請告訴我具體需要什麼？${taskHint}`,
      actionsTaken: [
        '✅ 確認專案已初始化',
        '🔧 準備開發工具'
      ],
      needsUserInput: true
    };
  }

  /**
   * 處理專案狀態查詢
   */
  private async handleProjectStatus(): Promise<AIAssistantResponse> {
    try {
      const snapshotResult = await this.contextManager.getProjectSnapshot();
      
      if (!snapshotResult.success) {
        return {
          message: `❌ 無法獲取專案狀態: ${snapshotResult.error}`,
          error: snapshotResult.error,
          needsUserInput: false
        };
      }

      const snapshot = snapshotResult.data!;
      const status = `📊 專案狀態摘要：

🏷️ **專案**: ${snapshot.projectInfo.name} (${snapshot.projectInfo.type})
${snapshot.projectInfo.isInitialized ? '✅' : '❌'} **初始化狀態**: ${snapshot.projectInfo.isInitialized ? '已完成' : '待初始化'}

📁 **檔案結構**: ${snapshot.fileStructure.files.length} 個檔案，${snapshot.fileStructure.directories.length} 個目錄

📦 **依賴管理**: 
   - 生產依賴: ${Object.keys(snapshot.dependencies.dependencies).length} 個
   - 開發依賴: ${Object.keys(snapshot.dependencies.devDependencies).length} 個

${snapshot.gitStatus ? `🔄 **Git狀態**: ${snapshot.gitStatus.branch} 分支${snapshot.gitStatus.hasChanges ? '（有未提交變更）' : '（無變更）'}` : ''}
${snapshot.buildStatus ? `🔨 **建置狀態**: ${snapshot.buildStatus.canBuild ? '可建置' : '有錯誤'}` : ''}`;

      return {
        message: status,
        actionsTaken: ['📊 獲取專案完整狀態'],
        needsUserInput: false
      };

    } catch (error) {
      return {
        message: `獲取專案狀態時發生錯誤: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
        needsUserInput: false
      };
    }
  }

  /**
   * 處理一般幫助請求
   */
  private async handleGeneralHelp(message: string): Promise<AIAssistantResponse> {
    const helpMessage = `🤖 我是您的AI專案助理！我可以幫您：

🔍 **專案探索**
- 掃描和分析專案結構
- 了解檔案組織和依賴關係
- 提供專案狀態報告

⚙️ **專案管理**  
- 初始化新的Next.js專案
- 管理專案依賴和配置
- 監控建置和Git狀態

🛠️ **開發協助**
- 創建React組件和頁面
- 編輯和管理專案檔案  
- 執行npm命令和Git操作

📊 **智能建議**
- 基於專案狀態提供建議
- 自動檢測和修復問題
- 最佳實踐指導

只要告訴我您想做什麼，我就會主動探索專案並提供協助！`;

    // 如果用戶有特定問題，可以在這裡添加針對性回應
    const specificHelp = message.toLowerCase().includes('如何') || message.toLowerCase().includes('怎麼') 
      ? '\n\n💡 看起來您有特定問題，請詳細描述您想要做什麼，我會提供具體的協助步驟。' 
      : '';

    return {
      message: helpMessage + specificHelp,
      needsUserInput: false
    };
  }

  /**
   * 處理預設回應
   */
  private async handleDefaultResponse(message: string): Promise<AIAssistantResponse> {
    // 自動探索專案以提供上下文
    const snapshotResult = await this.contextManager.getProjectSnapshot();
    
    let contextMessage = '';
    if (snapshotResult.success && snapshotResult.data) {
      const snapshot = snapshotResult.data;
      contextMessage = `

📋 **當前專案上下文**:
- 專案: ${snapshot.projectInfo.name} (${snapshot.projectInfo.type})
- 狀態: ${snapshot.projectInfo.isInitialized ? '已初始化' : '待初始化'}
- 檔案: ${snapshot.fileStructure.files.length} 個`;
    }

    // 分析用戶訊息以提供更好的回應
    const messageAnalysis = message.length > 50 
      ? '\n\n🔍 我注意到您的訊息比較詳細，讓我仔細分析您的需求...' 
      : '';

    return {
      message: `🤔 我了解您的需求。讓我基於當前專案狀態為您提供協助。${contextMessage}${messageAnalysis}

請告訴我更具體的需求，我可以：
- 🔍 詳細探索專案結構  
- 🛠️ 協助開發任務
- 📊 檢查專案狀態
- 💡 提供改進建議`,
      actionsTaken: ['🔍 自動獲取專案上下文'],
      needsUserInput: true
    };
  }

  /**
   * 添加到對話歷史
   */
  private addToHistory(message: ChatMessage): void {
    this.conversationHistory.push(message);
    
    // 保持歷史記錄在合理範圍內
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-40);
    }
  }

  /**
   * 獲取對話歷史
   */
  getConversationHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * 重置對話狀態
   */
  resetConversation(): void {
    this.conversationHistory = [];
    this.contextManager.resetCache();
  }

  /**
   * 獲取當前專案快照
   */
  async getCurrentProjectSnapshot(): Promise<ProjectSnapshot | null> {
    const result = await this.contextManager.getProjectSnapshot();
    return result.success ? result.data || null : null;
  }

  /**
   * 為指定訊息構建完整的AI提示詞
   * 這個方法可以讓外部系統（如聊天API）獲得完整的prompt
   */
  async buildFullPromptForMessage(userMessage: string): Promise<string> {
    try {
      // 獲取當前專案快照
      const snapshotResult = await this.contextManager.getProjectSnapshot();
      const projectSnapshot = snapshotResult.success ? snapshotResult.data : undefined;

      // 構建對話上下文
      const conversationContext: ConversationContext = {
        projectSnapshot,
        conversationHistory: this.conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        })),
        lastError: this.lastError,
        currentIntent: this.analyzeUserIntent(userMessage).type
      };

      // 構建完整提示詞
      return this.promptBuilder.buildCompletePrompt(userMessage, conversationContext);
    } catch (error) {
      console.error('構建提示詞時發生錯誤:', error);
      // 如果出錯，返回簡化版本
      return this.promptBuilder.buildSimplifiedPrompt(userMessage);
    }
  }

  /**
   * 獲取簡化版提示詞（性能優化版本）
   */
  async buildSimplifiedPromptForMessage(userMessage: string): Promise<string> {
    try {
      const snapshotResult = await this.contextManager.getProjectSnapshot();
      const projectSnapshot = snapshotResult.success ? snapshotResult.data : undefined;
      
      return this.promptBuilder.buildSimplifiedPrompt(userMessage, projectSnapshot);
    } catch (error) {
      console.error('構建簡化提示詞時發生錯誤:', error);
      return `請協助處理以下請求：${userMessage}`;
    }
  }
}

// 工廠函數
export function createAIProjectAssistant(projectContext: ProjectContext): AIProjectAssistant {
  return new AIProjectAssistant(projectContext);
}

// 使用範例和指南
export const AI_ASSISTANT_USAGE_GUIDE = `
# AI專案助理使用指南

## 🚀 快速開始

\`\`\`typescript
// 創建AI助理實例
const assistant = createAIProjectAssistant({
  projectId: 'container-id',
  projectName: 'my-project', 
  containerStatus: 'running'
});

// 處理用戶訊息
const response = await assistant.processUserMessage('目前專案有哪些檔案？');

console.log(response.message);        // AI的回應
console.log(response.projectReport);  // 專案報告（如有）
console.log(response.suggestions);    // 智能建議（如有）
console.log(response.actionsTaken);   // 執行的動作清單
\`\`\`

## 🎯 智能意圖識別

AI助理會自動識別用戶意圖：

- **專案探索**: "專案有哪些檔案？"、"目前專案狀態如何？"
- **檔案操作**: "創建一個新組件"、"修改配置檔案"  
- **開發任務**: "建立登入頁面"、"添加API路由"
- **專案管理**: "初始化專案"、"安裝依賴"、"執行測試"

## 🧠 自動上下文感知

AI會在需要時自動：
- 🔍 掃描專案結構
- 📋 分析關鍵檔案
- 🎯 提供相關建議
- ⚡ 執行必要操作

這樣AI就能真正"理解"您的專案並提供精準協助！
`; 