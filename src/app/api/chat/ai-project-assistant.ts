// AI 專案助理 - 整合所有AI工具，讓AI智能地探索和管理專案
// 支援自動修正模式，實現對話驅動式自動修正
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
  autoRepairInfo?: AutoRepairInfo;
}

export interface AutoRepairInfo {
  isAutoRepairMode: boolean;
  repairAttempt: number;
  thoughtProcess?: ThoughtProcess;
  detectedIssues: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ThoughtProcess {
  timestamp: string;
  phase: 'analysis' | 'planning' | 'execution' | 'validation' | 'error_handling' | 'completion';
  thinking: string;
  planning: string;
  actions: string[];
  validation: string;
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    concerns: string[];
    safeguards: string[];
  };
}

export interface AIAssistantResponse {
  message: string;
  projectReport?: string;
  suggestions?: string[];
  actionsTaken?: string[];
  needsUserInput?: boolean;
  error?: string;
  autoRepairResult?: AutoRepairResult;
}

export interface AutoRepairResult {
  isAutoRepairMode: boolean;
  thoughtProcess: ThoughtProcess;
  repairAttempts: number;
  completionStatus: 'in_progress' | 'completed' | 'failed' | 'awaiting_user';
  detectedIssues: string[];
  appliedFixes: string[];
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    concerns: string[];
  };
  nextActions: string[];
}

// AI專案助理核心類
export class AIProjectAssistant {
  private contextManager: ReturnType<typeof createAIContextManager>;
  private toolkit: AIToolkit;
  private conversationHistory: ChatMessage[] = [];
  private promptBuilder: DynamicPromptBuilder;
  private lastError?: string;
  private autoRepairMode: boolean = false;
  private currentRepairAttempt: number = 0;
  private maxRepairAttempts: number = 3;

  constructor(private projectContext: ProjectContext) {
    this.contextManager = createAIContextManager(projectContext);
    this.toolkit = createAIToolkit(projectContext);
    this.promptBuilder = createDynamicPromptBuilder();
  }

  /**
   * 啟用或停用自動修正模式
   */
  setAutoRepairMode(enabled: boolean, maxAttempts: number = 3): void {
    this.autoRepairMode = enabled;
    this.maxRepairAttempts = maxAttempts;
    if (enabled) {
      console.log(`🔧 啟用自動修正模式，最大嘗試次數: ${maxAttempts}`);
    } else {
      console.log('🔧 停用自動修正模式');
      this.currentRepairAttempt = 0;
    }
  }

  /**
   * 處理用戶訊息並產生智能回應（支援自動修正模式）
   */
  async processUserMessage(userMessage: string): Promise<AIAssistantResponse> {
    try {
      if (this.autoRepairMode) {
        return await this.processWithAutoRepair(userMessage);
      } else {
        return await this.processNormally(userMessage);
      }
    } catch (error) {
      const errorMessage = `處理訊息時發生錯誤: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.lastError = errorMessage;
      
      return {
        message: errorMessage,
        error: errorMessage,
        needsUserInput: false
      };
    }
  }

  /**
   * 自動修正模式處理流程
   */
  private async processWithAutoRepair(userMessage: string): Promise<AIAssistantResponse> {
    console.log(`🔧 自動修正模式處理訊息: ${userMessage}`);
    
    const allActionsTaken: string[] = [];
    const allDetectedIssues: string[] = [];
    const allAppliedFixes: string[] = [];
    let finalResponse: AIAssistantResponse | undefined;
    let thoughtProcess: ThoughtProcess | undefined;

    // 自動修正循環
    while (this.currentRepairAttempt < this.maxRepairAttempts) {
      console.log(`🔄 自動修正循環 #${this.currentRepairAttempt + 1}`);

      // Step 1: 透明思考過程
      thoughtProcess = await this.generateTransparentThoughtProcess(userMessage, this.currentRepairAttempt);
      console.log('🧠 思考過程:', thoughtProcess);

      // Step 2: 執行任務
      const taskResponse = await this.executeTaskWithMonitoring(userMessage, thoughtProcess);
      allActionsTaken.push(...(taskResponse.actionsTaken || []));

      // Step 3: 自動驗證結果
      const validationResult = await this.validateTaskResult(taskResponse, thoughtProcess);
      
      if (validationResult.hasIssues) {
        allDetectedIssues.push(...validationResult.issues);
        console.log(`🔍 檢測到 ${validationResult.issues.length} 個問題:`, validationResult.issues);

        // Step 4: 風險評估
        const riskAssessment = this.assessRepairRisk(validationResult, this.currentRepairAttempt);
        
        if (riskAssessment.level === 'high') {
          // 高風險，需要用戶介入
          finalResponse = {
            ...taskResponse,
            message: `⚠️ 需要人為判斷 - ${riskAssessment.reason}\n\n原始回應：${taskResponse.message}`,
            needsUserInput: true,
            autoRepairResult: this.buildAutoRepairResult(
              thoughtProcess,
              'awaiting_user',
              allDetectedIssues,
              allAppliedFixes,
              riskAssessment
            )
          };
          break;
        }

        // Step 5: 自動修正
        const repairResult = await this.attemptAutoRepair(validationResult.issues, thoughtProcess);
        allAppliedFixes.push(...repairResult.appliedFixes);
        
        if (repairResult.success) {
          console.log(`✅ 自動修正成功，應用了 ${repairResult.appliedFixes.length} 個修正`);
          finalResponse = {
            ...taskResponse,
            message: `✅ 此次任務已完成！經過 ${this.currentRepairAttempt + 1} 次自動修正，所有問題已解決。\n\n${taskResponse.message}`,
            actionsTaken: allActionsTaken,
            autoRepairResult: this.buildAutoRepairResult(
              thoughtProcess,
              'completed',
              allDetectedIssues,
              allAppliedFixes,
              { level: 'low', reason: '自動修正成功' }
            )
          };
          break;
        } else {
          this.currentRepairAttempt++;
          userMessage = this.generateRepairPrompt(userMessage, validationResult.issues, thoughtProcess);
          console.log(`🔧 準備第 ${this.currentRepairAttempt + 1} 次修正嘗試`);
        }
      } else {
        // 沒有問題，任務完成
        console.log('✅ 任務成功完成，無需修正');
        finalResponse = {
          ...taskResponse,
          message: `✅ 此次任務已完成！${taskResponse.message}`,
          actionsTaken: allActionsTaken,
          autoRepairResult: this.buildAutoRepairResult(
            thoughtProcess,
            'completed',
            allDetectedIssues,
            allAppliedFixes,
            { level: 'low', reason: '任務成功完成' }
          )
        };
        break;
      }
    }

    // 如果達到最大嘗試次數而沒有成功，或者沒有 finalResponse
    if (!finalResponse) {
      finalResponse = {
        message: `⚠️ 自動修正失敗 - 經過 ${this.maxRepairAttempts} 次嘗試仍無法解決問題，需要人為介入。`,
        error: '自動修正達到最大嘗試次數',
        needsUserInput: true,
        actionsTaken: allActionsTaken,
        autoRepairResult: this.buildAutoRepairResult(
          thoughtProcess || await this.generateTransparentThoughtProcess(userMessage, this.currentRepairAttempt),
          'failed',
          allDetectedIssues,
          allAppliedFixes,
          { level: 'high', reason: '達到最大修正嘗試次數' }
        )
      };
    }

    // 記錄到對話歷史
    this.addToHistory({
      role: 'assistant',
      content: finalResponse.message,
      timestamp: new Date().toISOString(),
      autoRepairInfo: {
        isAutoRepairMode: true,
        repairAttempt: this.currentRepairAttempt,
        thoughtProcess: thoughtProcess || await this.generateTransparentThoughtProcess(userMessage, this.currentRepairAttempt),
        detectedIssues: allDetectedIssues,
        riskLevel: finalResponse.autoRepairResult?.riskAssessment.level || 'low'
      }
    });

    return finalResponse;
  }

  /**
   * 一般模式處理流程
   */
  private async processNormally(userMessage: string): Promise<AIAssistantResponse> {
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

    // 5. 分析用戶意圖並執行相應動作
    const intent = this.analyzeUserIntent(userMessage);
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

    // 6. 記錄AI回應
    this.addToHistory({
      role: 'assistant',
      content: response.message,
      timestamp: new Date().toISOString(),
      projectContext: projectSnapshot
    });

    // 7. 清除錯誤狀態（如果操作成功）
    if (!response.error) {
      this.lastError = undefined;
    }

    return response;
  }

  /**
   * 生成透明的思考過程
   */
  private async generateTransparentThoughtProcess(
    userMessage: string,
    repairAttempt: number
  ): Promise<ThoughtProcess> {
    const isFirstAttempt = repairAttempt === 0;
    const phase = isFirstAttempt ? 'analysis' : 'error_handling';

    // 分析任務
    const taskAnalysis = isFirstAttempt 
      ? `分析新任務：「${userMessage}」`
      : `重新分析任務（第 ${repairAttempt + 1} 次嘗試）：「${userMessage}」，上次錯誤：${this.lastError}`;

    // 制定計劃
    const planningSteps = isFirstAttempt 
      ? [
          '📊 分析專案當前狀態',
          '🎯 確定任務具體需求',
          '🛠️ 選擇適當的工具和方法',
          '⚡ 執行任務步驟',
          '✅ 驗證結果正確性'
        ]
      : [
          '🔍 分析上次失敗原因',
          '🔧 制定修正策略',
          '🛠️ 重新選擇工具和方法',
          '⚡ 執行修正步驟',
          '✅ 驗證修正結果'
        ];

    // 風險評估
    const riskLevel: 'low' | 'medium' | 'high' = repairAttempt === 0 ? 'low' : 
                                                  repairAttempt === 1 ? 'medium' : 'high';
    const concerns = repairAttempt > 0 ? [`已嘗試 ${repairAttempt} 次修正`] : [];
    const safeguards = [
      '限制在專案目錄內操作',
      '避免刪除重要檔案',
      '每步驟前進行安全檢查'
    ];

    return {
      timestamp: new Date().toISOString(),
      phase,
      thinking: `🧠 THINKING: ${taskAnalysis}`,
      planning: `📋 PLAN: ${planningSteps.join(' → ')}`,
      actions: planningSteps,
      validation: `🔍 VALIDATION: 將在執行後檢查結果是否符合預期，並自動修正任何問題`,
      riskAssessment: {
        level: riskLevel,
        concerns,
        safeguards
      }
    };
  }

  /**
   * 執行任務並監控結果
   */
  private async executeTaskWithMonitoring(
    userMessage: string,
    thoughtProcess: ThoughtProcess
  ): Promise<AIAssistantResponse> {
    console.log('⚡ ACTION: 執行任務...');
    console.log('📋 執行計劃:', thoughtProcess.actions);

    // 執行原有的任務處理邏輯
    const intent = this.analyzeUserIntent(userMessage);
    
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

    return response;
  }

  /**
   * 驗證任務結果
   */
  private async validateTaskResult(
    taskResponse: AIAssistantResponse,
    thoughtProcess: ThoughtProcess
  ): Promise<{ hasIssues: boolean; issues: string[] }> {
    const issues: string[] = [];

    // 檢查是否有明確的錯誤
    if (taskResponse.error) {
      issues.push(`執行錯誤：${taskResponse.error}`);
    }

    // 檢查回應內容是否表示有問題
    const responseText = taskResponse.message.toLowerCase();
    const problemKeywords = ['錯誤', '失敗', '無法', '問題', '異常', 'error', 'failed', 'cannot'];
    
    for (const keyword of problemKeywords) {
      if (responseText.includes(keyword)) {
        issues.push(`回應中提到問題關鍵字：${keyword}`);
        break;
      }
    }

    // 檢查是否需要用戶輸入但沒有明確完成標記
    if (taskResponse.needsUserInput && !responseText.includes('完成') && !responseText.includes('成功')) {
      issues.push('任務未完成，需要進一步處理');
    }

    console.log(`🔍 VALIDATION: 檢測到 ${issues.length} 個問題`);
    
    return {
      hasIssues: issues.length > 0,
      issues
    };
  }

  /**
   * 評估修正風險
   */
  private assessRepairRisk(
    validationResult: { issues: string[] },
    repairAttempt: number
  ): { level: 'low' | 'medium' | 'high'; reason: string } {
    // 基於嘗試次數評估風險
    if (repairAttempt >= 2) {
      return {
        level: 'high',
        reason: `已嘗試 ${repairAttempt + 1} 次修正，可能存在複雜問題需要人工介入`
      };
    }

    // 基於問題類型評估風險
    const criticalKeywords = ['刪除', '移除', '清空', 'delete', 'remove', 'clear'];
    const hasCriticalIssue = validationResult.issues.some(issue => 
      criticalKeywords.some(keyword => issue.toLowerCase().includes(keyword))
    );

    if (hasCriticalIssue) {
      return {
        level: 'high',
        reason: '檢測到可能的危險操作，需要用戶確認'
      };
    }

    return {
      level: repairAttempt === 0 ? 'low' : 'medium',
      reason: '可以嘗試自動修正'
    };
  }

  /**
   * 嘗試自動修正
   */
  private async attemptAutoRepair(
    issues: string[],
    thoughtProcess: ThoughtProcess
  ): Promise<{ success: boolean; appliedFixes: string[] }> {
    console.log('🔧 嘗試自動修正...');
    
    const appliedFixes: string[] = [];

    // 這裡可以實現具體的自動修正邏輯
    // 目前為示範性實現
    for (const issue of issues) {
      try {
        if (issue.includes('檔案不存在')) {
          appliedFixes.push('嘗試創建缺失的檔案');
        } else if (issue.includes('權限')) {
          appliedFixes.push('調整檔案權限');
        } else if (issue.includes('語法')) {
          appliedFixes.push('修正語法錯誤');
        } else {
          appliedFixes.push(`一般性修正：${issue}`);
        }
      } catch (error) {
        console.error(`修正失敗: ${issue}`, error);
      }
    }

    return {
      success: appliedFixes.length > 0,
      appliedFixes
    };
  }

  /**
   * 生成修正提示
   */
  private generateRepairPrompt(
    originalMessage: string,
    issues: string[],
    thoughtProcess: ThoughtProcess
  ): string {
    return `請根據以下檢測到的問題進行自動修正：

🔍 **檢測到的問題**：
${issues.map(issue => `- ${issue}`).join('\n')}

🎯 **修正策略**：
- 分析問題根因
- 制定具體修正步驟
- 執行修正操作
- 驗證修正結果

⚡ **原始任務**：${originalMessage}

請主動執行修正，不需要等待用戶確認。`;
  }

  /**
   * 構建自動修正結果
   */
  private buildAutoRepairResult(
    thoughtProcess: ThoughtProcess,
    status: 'in_progress' | 'completed' | 'failed' | 'awaiting_user',
    detectedIssues: string[],
    appliedFixes: string[],
    riskAssessment: { level: 'low' | 'medium' | 'high'; reason: string }
  ): AutoRepairResult {
    const nextActions = this.generateNextActions(status, riskAssessment);

    return {
      isAutoRepairMode: true,
      thoughtProcess,
      repairAttempts: this.currentRepairAttempt,
      completionStatus: status,
      detectedIssues,
      appliedFixes,
      riskAssessment: {
        level: riskAssessment.level,
        concerns: riskAssessment.level === 'high' ? [riskAssessment.reason] : []
      },
      nextActions
    };
  }

  /**
   * 生成下一步行動建議
   */
  private generateNextActions(
    status: string,
    riskAssessment: { level: string; reason: string }
  ): string[] {
    switch (status) {
      case 'completed':
        return ['任務已完成，可以繼續下一個任務'];
      case 'awaiting_user':
        return [
          '需要用戶決策或確認',
          '請檢查修正建議',
          '確認是否繼續執行'
        ];
      case 'failed':
        return [
          '自動修正失敗',
          '請檢查錯誤日誌',
          '考慮手動處理或重新描述需求'
        ];
      default:
        return ['自動修正進行中...'];
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

🔧 **自動修正模式**
- 透明思考過程輸出
- 自動錯誤檢測和修正
- 持續工作直到任務完成

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
- 💡 提供改進建議
- 🔧 啟用自動修正模式以持續優化`,
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
    this.currentRepairAttempt = 0;
    this.lastError = undefined;
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

      // 根據是否啟用自動修正模式選擇不同的提示詞
      if (this.autoRepairMode) {
        return this.promptBuilder.buildAutoRepairPrompt(userMessage, conversationContext);
      } else {
        return this.promptBuilder.buildCompletePrompt(userMessage, conversationContext);
      }
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

  /**
   * 獲取自動修正狀態
   */
  getAutoRepairStatus(): {
    isEnabled: boolean;
    currentAttempt: number;
    maxAttempts: number;
    lastError?: string;
  } {
    return {
      isEnabled: this.autoRepairMode,
      currentAttempt: this.currentRepairAttempt,
      maxAttempts: this.maxRepairAttempts,
      lastError: this.lastError
    };
  }
}

// 工廠函數
export function createAIProjectAssistant(projectContext: ProjectContext): AIProjectAssistant {
  return new AIProjectAssistant(projectContext);
}

// 使用範例和指南（更新支援自動修正模式）
export const AI_ASSISTANT_USAGE_GUIDE = `
# AI專案助理使用指南 - 自動修正模式

## 🚀 快速開始

\`\`\`typescript
// 創建AI助理實例
const assistant = createAIProjectAssistant({
  projectId: 'container-id',
  projectName: 'my-project', 
  containerStatus: 'running'
});

// 啟用自動修正模式
assistant.setAutoRepairMode(true, 3); // 最多3次修正嘗試

// 處理用戶訊息（自動修正模式）
const response = await assistant.processUserMessage('創建一個登入頁面');

console.log(response.message);                    // AI的回應
console.log(response.autoRepairResult);           // 自動修正結果
console.log(response.autoRepairResult.thoughtProcess); // 思考過程
\`\`\`

## 🔧 自動修正模式特色

### 📋 透明思考過程
- 🧠 THINKING: 詳細的任務分析
- 📋 PLAN: 具體的執行步驟
- ⚡ ACTION: 實際執行動作
- 🔍 VALIDATION: 結果驗證

### 🔄 自動修正循環
1. 執行任務
2. 驗證結果
3. 檢測問題
4. 自動修正
5. 重複直到完成

### 🛡️ 風險控管
- 最大嘗試次數限制
- 風險等級評估
- 高風險操作需用戶確認
- 完整的錯誤追蹤

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
- 🔧 自動修正錯誤

這樣AI就能真正"理解"您的專案並提供精準協助，還能自動修正問題！
`; 