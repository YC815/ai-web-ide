// OpenAI Function Calling API 端點 - 支援自動修正模式
// 整合 AI 編輯器工具和 OpenAI function calling，實現對話驅動式自動修正

import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIIntegration, OpenAIIntegrationConfig, OpenAIIntegration } from '@/lib/ai/openai';
import { dockerConfigManager } from '@/lib/docker/config-manager';
import { logger } from '@/lib/core/logger';

// 自動修正模式的狀態管理
interface AutoRepairSession {
  id: string;
  conversationId: string;
  isAutoRepairMode: boolean;
  currentTask: string;
  repairAttempts: number;
  maxRepairAttempts: number;
  lastToolOutput: unknown;
  thoughtProcess: ThoughtProcess[];
  riskLevel: 'low' | 'medium' | 'high';
  needsUserIntervention: boolean;
  completionStatus: 'in_progress' | 'completed' | 'failed' | 'awaiting_user';
}

interface ThoughtProcess {
  timestamp: string;
  phase: 'analysis' | 'planning' | 'execution' | 'validation' | 'error_handling';
  content: string;
  reasoning: string;
  plannedActions: string[];
  detectedIssues: string[];
}

interface AutoRepairResult {
  success: boolean;
  message: string;
  thoughtProcess: ThoughtProcess;
  actionsTaken: string[];
  toolCallsExecuted: number;
  needsUserInput: boolean;
  completionStatus: 'in_progress' | 'completed' | 'failed' | 'awaiting_user';
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    concerns: string[];
  };
  nextSteps: string[];
}

// 全域 OpenAI 整合實例管理器（擴展支援自動修正）
class AutoRepairIntegrationManager {
  private static instance: AutoRepairIntegrationManager;
  private integrations: Map<string, OpenAIIntegration> = new Map();
  private sessionToIntegration: Map<string, string> = new Map();
  private autoRepairSessions: Map<string, AutoRepairSession> = new Map();

  static getInstance(): AutoRepairIntegrationManager {
    if (!AutoRepairIntegrationManager.instance) {
      AutoRepairIntegrationManager.instance = new AutoRepairIntegrationManager();
    }
    return AutoRepairIntegrationManager.instance;
  }

  async getOrCreateIntegration(
    projectId: string, 
    projectName: string, 
    apiToken: string
  ): Promise<OpenAIIntegration> {
    const integrationKey = `${projectId}_${apiToken.slice(-8)}`;
    
    if (!this.integrations.has(integrationKey)) {
      // 自動檢測 Docker 配置
      const dockerConfig = await dockerConfigManager.autoDetectDockerContext(projectName);
      
      logger.info('Integration', 'Creating new OpenAI integration', {
        projectId,
        projectName,
        integrationKey,
        dockerConfigSuccess: dockerConfig.success,
        dockerMessage: dockerConfig.message
      });

      const config: OpenAIIntegrationConfig = {
        openaiApiKey: apiToken,
        model: 'gpt-4o',
        dockerAIEditorConfig: {
          dockerContext: dockerConfig.dockerContext || {
            containerId: `fallback-${projectId}`,
            containerName: `ai-dev-${projectName}`,
            workingDirectory: '/app',
            status: 'error'
          },
          enableUserConfirmation: true,
          enableActionLogging: true,
          enableAdvancedTools: true
        },
        enableToolCallLogging: true,
        maxToolCalls: 20 // 增加工具調用次數以支援自動修正
      };

      const integration = createOpenAIIntegration(config);
      this.integrations.set(integrationKey, integration);
      
      console.log(`🚀 創建新的 OpenAI 整合實例: ${integrationKey}`);
      if (!dockerConfig.success) {
        console.warn(`⚠️ Docker 配置警告: ${dockerConfig.message}`);
      }
    }

    return this.integrations.get(integrationKey)!;
  }

  getOrCreateSession(
    integration: OpenAIIntegration,
    conversationId: string,
    projectName: string,
    autoRepairMode: boolean = false
  ): string {
    let sessionId = this.sessionToIntegration.get(conversationId);
    
    if (!sessionId || !integration.getSession(sessionId)) {
      // 根據是否啟用自動修正模式，使用不同的系統提示詞
      const systemPrompt = autoRepairMode ? 
        this.buildAutoRepairSystemPrompt(projectName) : 
        this.buildNormalSystemPrompt(projectName);
      
      sessionId = integration.createSession(systemPrompt);
      this.sessionToIntegration.set(conversationId, sessionId);
      
      // 如果是自動修正模式，初始化修正會話
      if (autoRepairMode) {
        this.initializeAutoRepairSession(conversationId, sessionId);
      }
      
      console.log(`📝 創建新會話: ${conversationId} -> ${sessionId} (自動修正: ${autoRepairMode})`);
    }

    return sessionId;
  }

  private buildAutoRepairSystemPrompt(projectName: string): string {
    return `你是一個具備自動修正能力的 AI 編程助手，專門協助開發 ${projectName} 專案。

🎯 **自動修正模式特殊行為**：

1. **透明思考過程**：
   - 每次行動前，先輸出完整的思考分析
   - 包含：任務分解、判斷邏輯、執行計畫、風險評估
   - 格式：使用 🧠 THINKING、📋 PLAN、⚡ ACTION、🔍 VALIDATION 標記

2. **自動錯誤修正**：
   - 工具執行後，自動分析 output 和錯誤
   - 若發現問題，立即產出：錯誤分析 → 修正策略 → 自動執行修正
   - 不需等待用戶指令，自動進行最多 3 次修正嘗試

3. **完成狀態管理**：
   - 任務完成時，明確宣告：「✅ 此次任務已完成」
   - 需要用戶介入時，宣告：「🔍 等待使用者回覆」
   - 遇到風險時，宣告：「⚠️ 需要人為判斷」

4. **風險控管**：
   - 避免危險操作（刪除重要檔案、修改核心配置）
   - 連續修正失敗時，主動請求用戶介入
   - 超出能力範圍時，誠實說明限制

🔧 **可用Docker工具**：
- docker_start_dev_server: 在容器內啟動開發伺服器
- docker_restart_dev_server: 在容器內重啟開發伺服器
- docker_read_log_tail: 讀取容器內日誌
- docker_search_error_logs: 搜尋容器內錯誤日誌
- docker_check_health: 檢查容器內服務健康狀態
- docker_read_file: 讀取容器內檔案
- docker_write_file: 寫入容器內檔案
- docker_smart_monitor_and_recover: 智能監控與自動修復
- ask_user: 與用戶確認操作

記住：在自動修正模式下，你需要主動、積極、持續地工作，直到任務真正完成或需要用戶介入。`;
  }

  private buildNormalSystemPrompt(projectName: string): string {
    return `你是一個專業的 AI 編程助手，專門協助開發 ${projectName} 專案。

🎯 **你的核心能力**：
- 分析和理解專案結構
- 讀取、編輯和創建檔案
- 執行安全的終端命令
- 生成精確的代碼修改建議
- 與用戶確認重要操作

🔧 **可用Docker工具**：
- docker_start_dev_server: 在容器內啟動開發伺服器
- docker_restart_dev_server: 在容器內重啟開發伺服器
- docker_read_log_tail: 讀取容器內日誌
- docker_search_error_logs: 搜尋容器內錯誤日誌
- docker_check_health: 檢查容器內服務健康狀態
- docker_read_file: 讀取容器內檔案
- docker_write_file: 寫入容器內檔案
- docker_smart_monitor_and_recover: 智能監控與自動修復
- ask_user: 與用戶確認操作

🛡️ **安全原則**：
- 重要操作前先使用 ask_user 確認
- 只執行白名單內的安全命令
- 所有檔案操作限制在專案目錄內

請根據用戶需求主動選擇和使用適當的工具來完成任務。`;
  }

  private initializeAutoRepairSession(conversationId: string, sessionId: string): void {
    const session: AutoRepairSession = {
      id: sessionId,
      conversationId,
      isAutoRepairMode: true,
      currentTask: '',
      repairAttempts: 0,
      maxRepairAttempts: 3,
      lastToolOutput: null,
      thoughtProcess: [],
      riskLevel: 'low',
      needsUserIntervention: false,
      completionStatus: 'in_progress'
    };

    this.autoRepairSessions.set(conversationId, session);
    console.log(`🔧 初始化自動修正會話: ${conversationId}`);
  }

  getAutoRepairSession(conversationId: string): AutoRepairSession | undefined {
    return this.autoRepairSessions.get(conversationId);
  }

  updateAutoRepairSession(conversationId: string, updates: Partial<AutoRepairSession>): void {
    const session = this.autoRepairSessions.get(conversationId);
    if (session) {
      Object.assign(session, updates);
      this.autoRepairSessions.set(conversationId, session);
    }
  }

  // 自動修正核心邏輯
  async executeAutoRepairCycle(
    integration: OpenAIIntegration,
    sessionId: string,
    conversationId: string,
    userMessage: string
  ): Promise<AutoRepairResult> {
    const session = this.getAutoRepairSession(conversationId);
    if (!session) {
      throw new Error('自動修正會話不存在');
    }

    let totalToolCalls = 0;
    const allActionsTaken: string[] = [];
    let finalThoughtProcess: ThoughtProcess;

    // 更新當前任務
    this.updateAutoRepairSession(conversationId, { 
      currentTask: userMessage,
      repairAttempts: 0 
    });

    while (session.completionStatus === 'in_progress' && session.repairAttempts < session.maxRepairAttempts) {
      try {
        console.log(`🔄 自動修正循環 #${session.repairAttempts + 1}: ${conversationId}`);

        // Step 1: 發送訊息並執行工具
        const result = await integration.sendMessage(sessionId, userMessage, {
          maxToolCalls: 15,
          temperature: 0.1
        });

        totalToolCalls += result.toolCallsExecuted;
        
        // Step 2: 分析工具執行結果
        const thoughtProcess = this.analyzeToolResults(result);
        finalThoughtProcess = thoughtProcess;
        
        session.thoughtProcess.push(thoughtProcess);
        allActionsTaken.push(...thoughtProcess.plannedActions);

        // Step 3: 評估是否需要繼續修正
        const needsRepair = this.assessNeedsRepair(thoughtProcess, result);
        
        if (!needsRepair.needsRepair) {
          // 任務完成
          this.updateAutoRepairSession(conversationId, { 
            completionStatus: 'completed',
            needsUserIntervention: false
          });
          break;
        }

        if (needsRepair.riskLevel === 'high') {
          // 風險過高，需要用戶介入
          this.updateAutoRepairSession(conversationId, { 
            completionStatus: 'awaiting_user',
            needsUserIntervention: true,
            riskLevel: 'high'
          });
          break;
        }

        // Step 4: 準備下一輪修正
        session.repairAttempts++;
        userMessage = this.generateRepairMessage(thoughtProcess, needsRepair);
        
        this.updateAutoRepairSession(conversationId, { 
          repairAttempts: session.repairAttempts,
          lastToolOutput: result
        });

        console.log(`🔧 準備第 ${session.repairAttempts} 次修正: ${needsRepair.reason}`);

      } catch (error) {
        console.error(`❌ 自動修正循環錯誤:`, error);
        
        session.repairAttempts++;
        if (session.repairAttempts >= session.maxRepairAttempts) {
          this.updateAutoRepairSession(conversationId, { 
            completionStatus: 'failed',
            needsUserIntervention: true
          });
        }
      }
    }

    // 最終結果評估
    return {
      success: session.completionStatus === 'completed',
      message: this.generateFinalMessage(session),
      thoughtProcess: finalThoughtProcess!,
      actionsTaken: allActionsTaken,
      toolCallsExecuted: totalToolCalls,
      needsUserInput: session.needsUserIntervention,
      completionStatus: session.completionStatus,
      riskAssessment: {
        level: session.riskLevel,
        concerns: this.extractRiskConcerns(session)
      },
      nextSteps: this.generateNextSteps(session)
    };
  }

  private analyzeToolResults(result: unknown): ThoughtProcess {
    const thoughtProcess: ThoughtProcess = {
      timestamp: new Date().toISOString(),
      phase: 'validation',
      content: '',
      reasoning: '',
      plannedActions: [],
      detectedIssues: []
    };

    // 分析工具執行結果
    const resultObj = result as { toolCallsExecuted?: number; session?: { toolCallLogs?: Array<{ success: boolean; toolName: string; error?: string }> } };
    if (resultObj.toolCallsExecuted && resultObj.toolCallsExecuted > 0) {
      thoughtProcess.content = `執行了 ${resultObj.toolCallsExecuted} 個工具調用`;
      thoughtProcess.reasoning = '分析工具執行結果以判斷是否需要進一步修正';
      
      // 檢查是否有錯誤或警告
      if (resultObj.session?.toolCallLogs) {
        const errors = resultObj.session.toolCallLogs.filter(log => log.success === false);
        if (errors.length > 0) {
          thoughtProcess.detectedIssues = errors.map(err => 
            `工具 ${err.toolName} 執行失敗: ${err.error || '未知錯誤'}`
          );
        }
      }
    }

    return thoughtProcess;
  }

  private assessNeedsRepair(thoughtProcess: ThoughtProcess, result: unknown): {
    needsRepair: boolean;
    reason: string;
    riskLevel: 'low' | 'medium' | 'high';
  } {
    // 檢查是否有檢測到的問題
    if (thoughtProcess.detectedIssues.length > 0) {
      return {
        needsRepair: true,
        reason: `檢測到 ${thoughtProcess.detectedIssues.length} 個問題需要修正`,
        riskLevel: 'medium'
      };
    }

    // 檢查是否有工具執行失敗
    const resultObj = result as { session?: { toolCallLogs?: Array<{ success: boolean }> }; response?: string };
    if (resultObj.session?.toolCallLogs) {
      const failedCalls = resultObj.session.toolCallLogs.filter(log => log.success === false);
      if (failedCalls.length > 0) {
        return {
          needsRepair: true,
          reason: `有 ${failedCalls.length} 個工具調用失敗`,
          riskLevel: failedCalls.length > 2 ? 'high' : 'medium'
        };
      }
    }

    // 檢查回應內容是否表示需要繼續
    const responseText = (resultObj.response || '').toLowerCase();
    if (responseText.includes('錯誤') || responseText.includes('失敗') || responseText.includes('問題')) {
      return {
        needsRepair: true,
        reason: 'AI 回應中提到了錯誤或問題',
        riskLevel: 'low'
      };
    }

    return {
      needsRepair: false,
      reason: '任務已完成，無需進一步修正',
      riskLevel: 'low'
    };
  }

  private generateRepairMessage(thoughtProcess: ThoughtProcess, needsRepair: { reason: string }): string {
    return `請根據以下問題進行自動修正：

🔍 **檢測到的問題**：
${thoughtProcess.detectedIssues.map(issue => `- ${issue}`).join('\n')}

🎯 **修正目標**：${needsRepair.reason}

請主動分析問題、制定修正策略並執行修正操作。`;
  }

  private generateFinalMessage(session: AutoRepairSession): string {
    switch (session.completionStatus) {
      case 'completed':
        return `✅ 此次任務已完成！經過 ${session.repairAttempts} 次自動修正，所有問題已解決。`;
      case 'awaiting_user':
        return `🔍 等待使用者回覆 - 需要您的決策才能繼續進行。`;
      case 'failed':
        return `⚠️ 自動修正失敗 - 經過 ${session.maxRepairAttempts} 次嘗試仍無法解決問題，需要人為介入。`;
      default:
        return `🔄 任務進行中...`;
    }
  }

  private extractRiskConcerns(session: AutoRepairSession): string[] {
    const concerns = [];
    
    if (session.repairAttempts >= 2) {
      concerns.push('多次修正嘗試，可能存在複雜問題');
    }
    
    if (session.riskLevel === 'high') {
      concerns.push('高風險操作，建議人工檢查');
    }
    
    return concerns;
  }

  private generateNextSteps(session: AutoRepairSession): string[] {
    const steps = [];
    
    switch (session.completionStatus) {
      case 'completed':
        steps.push('可以繼續下一個任務');
        break;
      case 'awaiting_user':
        steps.push('請檢查修正結果');
        steps.push('確認是否需要進一步調整');
        break;
      case 'failed':
        steps.push('檢查錯誤日誌');
        steps.push('考慮手動解決問題');
        break;
    }
    
    return steps;
  }

  cleanup(): void {
    if (this.integrations.size > 50) {
      const oldestKey = this.integrations.keys().next().value;
      if (oldestKey) {
        this.integrations.delete(oldestKey);
        console.log(`🧹 清理過期的整合實例: ${oldestKey}`);
      }
    }

    if (this.autoRepairSessions.size > 100) {
      const oldestSessionKey = this.autoRepairSessions.keys().next().value;
      if (oldestSessionKey) {
        this.autoRepairSessions.delete(oldestSessionKey);
        console.log(`🧹 清理過期的自動修正會話: ${oldestSessionKey}`);
      }
    }
  }
}

// 獲取全域管理器實例
const integrationManager = AutoRepairIntegrationManager.getInstance();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      message, 
      projectId, 
      projectName, 
      conversationId, 
      apiToken,
      autoRepairMode = false // 新增自動修正模式參數
    } = body;

    // 驗證必要參數
    if (!message || !projectId || !apiToken) {
      return NextResponse.json({
        success: false,
        error: '缺少必要參數：message, projectId, apiToken'
      }, { status: 400 });
    }

    if (!apiToken.startsWith('sk-')) {
      return NextResponse.json({
        success: false,
        error: 'API Token 格式不正確，應該以 sk- 開頭'
      }, { status: 400 });
    }

    if (!conversationId) {
      return NextResponse.json({
        success: false,
        error: '缺少 conversationId 參數'
      }, { status: 400 });
    }

    console.log(`🔄 處理請求: ${conversationId} - ${message.slice(0, 50)}... (自動修正: ${autoRepairMode})`);

    // 獲取或創建 OpenAI 整合實例
    const openaiIntegration = await integrationManager.getOrCreateIntegration(
      projectId, 
      projectName || 'Unknown Project', 
      apiToken
    );

    // 獲取或創建會話
    const sessionId = integrationManager.getOrCreateSession(
      openaiIntegration,
      conversationId,
      projectName || 'Unknown Project',
      autoRepairMode
    );

    let responseData;

    if (autoRepairMode) {
      // 執行自動修正循環
      const autoRepairResult = await integrationManager.executeAutoRepairCycle(
        openaiIntegration,
        sessionId,
        conversationId,
        message
      );

      responseData = {
        message: autoRepairResult.message,
        autoRepairMode: true,
        autoRepairResult: {
          success: autoRepairResult.success,
          thoughtProcess: autoRepairResult.thoughtProcess,
          actionsTaken: autoRepairResult.actionsTaken,
          toolCallsExecuted: autoRepairResult.toolCallsExecuted,
          completionStatus: autoRepairResult.completionStatus,
          riskAssessment: autoRepairResult.riskAssessment,
          nextSteps: autoRepairResult.nextSteps
        },
        session: {
          id: sessionId,
          conversationId: conversationId,
          repairSession: integrationManager.getAutoRepairSession(conversationId)
        },
        needsUserInput: autoRepairResult.needsUserInput,
        projectInfo: {
          projectId,
          projectName,
          projectPath: process.cwd()
        }
      };
    } else {
      // 一般模式處理
      const result = await openaiIntegration.sendMessage(sessionId, message, {
        maxToolCalls: 10,
        temperature: 0.1
      });

      const stats = openaiIntegration.getToolCallStats(sessionId);
      const pendingActions = openaiIntegration.getPendingActions();

      responseData = {
        message: result.response,
        autoRepairMode: false,
        toolCallsExecuted: result.toolCallsExecuted,
        session: {
          id: sessionId,
          conversationId: conversationId,
          messageCount: result.session.messages.length,
          toolCallCount: result.session.toolCallLogs.length
        },
        stats: {
          totalCalls: stats.totalCalls,
          successfulCalls: stats.successfulCalls,
          failedCalls: stats.failedCalls,
          averageExecutionTime: Math.round(stats.averageExecutionTime),
          toolUsage: stats.toolUsage
        },
        pendingActions: pendingActions.map((action: { id: string; toolName: string; status: string; confirmationRequest?: { message: string } }) => ({
          id: action.id,
          toolName: action.toolName,
          status: action.status,
          confirmationMessage: action.confirmationRequest?.message,
          requiresConfirmation: !!action.confirmationRequest
        })),
        projectInfo: {
          projectId,
          projectName,
          projectPath: process.cwd()
        }
      };
    }

    // 執行清理
    integrationManager.cleanup();

    console.log(`✅ 請求處理完成: ${conversationId} - 模式: ${autoRepairMode ? '自動修正' : '一般'}`);

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('OpenAI Function Calling API 錯誤:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}

// 處理用戶確認操作（保持不變）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, actionId, confirmed, data, projectId, apiToken } = body;

    if (!conversationId || !actionId || confirmed === undefined) {
      return NextResponse.json({
        success: false,
        error: '缺少必要參數：conversationId, actionId, confirmed'
      }, { status: 400 });
    }

    if (!projectId || !apiToken) {
      return NextResponse.json({
        success: false,
        error: '缺少必要參數：projectId, apiToken'
      }, { status: 400 });
    }

    console.log(`🔄 處理用戶確認: ${conversationId} - ${actionId} - ${confirmed}`);

    const openaiIntegration = await integrationManager.getOrCreateIntegration(
      projectId, 
      'Unknown Project', 
      apiToken
    );
    
    await openaiIntegration.handleUserConfirmation(actionId, confirmed, data);

    console.log(`✅ 用戶確認處理完成: ${actionId} - ${confirmed ? '已確認' : '已取消'}`);

    return NextResponse.json({
      success: true,
      message: confirmed ? '操作已確認' : '操作已取消'
    });

  } catch (error) {
    console.error('處理用戶確認錯誤:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    }, { status: 500 });
  }
}

// 新增：獲取自動修正會話狀態
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const action = searchParams.get('action');

    if (action === 'repair-status' && conversationId) {
      const session = integrationManager.getAutoRepairSession(conversationId);
      
      if (!session) {
        return NextResponse.json({
          success: false,
          error: '找不到自動修正會話'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: {
          conversationId,
          isAutoRepairMode: session.isAutoRepairMode,
          currentTask: session.currentTask,
          repairAttempts: session.repairAttempts,
          maxRepairAttempts: session.maxRepairAttempts,
          completionStatus: session.completionStatus,
          riskLevel: session.riskLevel,
          needsUserIntervention: session.needsUserIntervention,
          thoughtProcessCount: session.thoughtProcess.length
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: '不支援的操作或缺少參數'
    }, { status: 400 });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    }, { status: 500 });
  }
} 