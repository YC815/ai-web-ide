// OpenAI Function Calling API 端點
// 整合 AI 編輯器工具和 OpenAI function calling

import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIIntegration, OpenAIIntegrationConfig, OpenAIIntegration } from '@/lib/openai-integration';

// 全域 OpenAI 整合實例管理器
class OpenAIIntegrationManager {
  private static instance: OpenAIIntegrationManager;
  private integrations: Map<string, OpenAIIntegration> = new Map();
  private sessionToIntegration: Map<string, string> = new Map();

  static getInstance(): OpenAIIntegrationManager {
    if (!OpenAIIntegrationManager.instance) {
      OpenAIIntegrationManager.instance = new OpenAIIntegrationManager();
    }
    return OpenAIIntegrationManager.instance;
  }

  getOrCreateIntegration(
    projectId: string, 
    projectName: string, 
    apiToken: string
  ): OpenAIIntegration {
    const integrationKey = `${projectId}_${apiToken.slice(-8)}`;
    
    if (!this.integrations.has(integrationKey)) {
      const config: OpenAIIntegrationConfig = {
        openaiApiKey: apiToken,
        model: 'gpt-4',
        aiEditorConfig: {
          projectPath: process.cwd(), // 使用當前工作目錄
          projectContext: {
            projectId,
            projectName,
            containerStatus: 'running'
          },
          enableAdvancedTools: true,
          enableUserConfirmation: true,
          enableActionLogging: true
        },
        enableToolCallLogging: true,
        maxToolCalls: 15
      };

      const integration = createOpenAIIntegration(config);
      this.integrations.set(integrationKey, integration);
      console.log(`🚀 創建新的 OpenAI 整合實例: ${integrationKey}`);
    }

    return this.integrations.get(integrationKey)!;
  }

  getOrCreateSession(
    integration: OpenAIIntegration,
    conversationId: string,
    projectName: string
  ): string {
    // 檢查是否已有對應的會話
    let sessionId = this.sessionToIntegration.get(conversationId);
    
    if (!sessionId || !integration.getSession(sessionId)) {
      // 創建新會話
      sessionId = integration.createSession(`你是一個專業的 AI 編程助手，專門協助開發 ${projectName} 專案。

🎯 **你的核心能力**：
- 分析和理解專案結構
- 讀取、編輯和創建檔案
- 執行安全的終端命令
- 生成精確的代碼修改建議
- 與用戶確認重要操作

🔧 **可用工具**：
- read_file: 讀取檔案內容
- list_files: 列出檔案清單
- search_code: 搜尋代碼關鍵字
- propose_diff: 生成代碼修改建議
- run_command: 執行終端指令
- ask_user: 與用戶確認操作
- get_project_context: 獲取專案結構
- get_git_diff: 獲取 Git 變更
- test_file: 執行測試

🛡️ **安全原則**：
- 重要操作前先使用 ask_user 確認
- 只執行白名單內的安全命令
- 所有檔案操作限制在專案目錄內

請根據用戶需求主動選擇和使用適當的工具來完成任務。`);
      
      this.sessionToIntegration.set(conversationId, sessionId);
      console.log(`📝 創建新會話: ${conversationId} -> ${sessionId}`);
    } else {
      console.log(`♻️ 使用現有會話: ${conversationId} -> ${sessionId}`);
    }

    return sessionId;
  }

  // 清理過期的整合實例（可選的記憶體管理）
  cleanup(): void {
    if (this.integrations.size > 50) {
      const oldestKey = this.integrations.keys().next().value;
      if (oldestKey) {
        this.integrations.delete(oldestKey);
        console.log(`🧹 清理過期的整合實例: ${oldestKey}`);
      }
    }
  }
}

// 獲取全域管理器實例
const integrationManager = OpenAIIntegrationManager.getInstance();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      message, 
      projectId, 
      projectName, 
      conversationId, 
      apiToken
    } = body;

    // 驗證必要參數
    if (!message || !projectId || !apiToken) {
      return NextResponse.json({
        success: false,
        error: '缺少必要參數：message, projectId, apiToken'
      }, { status: 400 });
    }

    // 驗證 API Token 格式
    if (!apiToken.startsWith('sk-')) {
      return NextResponse.json({
        success: false,
        error: 'API Token 格式不正確，應該以 sk- 開頭'
      }, { status: 400 });
    }

    // 驗證 conversationId
    if (!conversationId) {
      return NextResponse.json({
        success: false,
        error: '缺少 conversationId 參數'
      }, { status: 400 });
    }

    console.log(`🔄 處理請求: ${conversationId} - ${message.slice(0, 50)}...`);

    // 獲取或創建 OpenAI 整合實例
    const openaiIntegration = integrationManager.getOrCreateIntegration(
      projectId, 
      projectName || 'Unknown Project', 
      apiToken
    );

    // 獲取或創建會話
    const sessionId = integrationManager.getOrCreateSession(
      openaiIntegration,
      conversationId,
      projectName || 'Unknown Project'
    );

    // 發送訊息並處理工具調用
    const result = await openaiIntegration.sendMessage(sessionId, message, {
      maxToolCalls: 10,
      temperature: 0.1
    });

    // 獲取工具調用統計
    const stats = openaiIntegration.getToolCallStats(sessionId);
    
    // 獲取待處理的操作
    const pendingActions = openaiIntegration.getPendingActions();
    
    console.log('🔍 待處理操作數量:', pendingActions.length);
    console.log('🔍 待處理操作詳情:', pendingActions);

    // 構建回應
    const responseData = {
      message: result.response,
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
      pendingActions: pendingActions.map(action => ({
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
    
    console.log('🔍 回應數據中的 pendingActions:', responseData.pendingActions);

    // 執行清理（可選）
    integrationManager.cleanup();

    console.log(`✅ 請求處理完成: ${conversationId} - 執行了 ${result.toolCallsExecuted} 個工具`);

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

// 處理用戶確認操作
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

    // 獲取對應的整合實例
    const openaiIntegration = integrationManager.getOrCreateIntegration(
      projectId, 
      'Unknown Project', 
      apiToken
    );
    
    // 處理用戶確認
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