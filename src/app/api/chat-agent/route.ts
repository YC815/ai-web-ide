import { NextRequest, NextResponse } from 'next/server';
import { SecureChatAgentIntegrator, SecureChatAgentConfig, SecureChatAgentResponse } from '../../../lib/ai/secure-chat-agent-integration';
import { logger } from '../../../lib/logger';

// 全域管理安全聊天 Agent 實例
const secureAgentInstances = new Map<string, SecureChatAgentIntegrator>();

export interface ChatAgentRequest {
  message: string;
  projectId: string;
  projectName: string; // 安全模式必需參數
  conversationId?: string;
  apiToken: string;
  
  // Agent 配置
  maxToolCalls?: number;
  maxRetries?: number;
  timeoutMs?: number;
  enableLogging?: boolean;
  
  // 聊天特定配置
  enableAutoRepair?: boolean;
  temperature?: number;
  model?: string;
  containerId?: string;
}

export interface ChatAgentApiResponse {
  success: boolean;
  data?: SecureChatAgentResponse;
  error?: string;
  timestamp: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ChatAgentApiResponse>> {
  try {
    const body: ChatAgentRequest = await request.json();
    const { 
      message, 
      projectId, 
      projectName, // 不提供預設值，強制要求用戶提供
      conversationId,
      apiToken,
      maxToolCalls = 30,
      maxRetries = 2,
      timeoutMs = 30000,
      enableLogging = true,
      enableAutoRepair = false,
      temperature = 0.1,
      model = 'gpt-4o',
      containerId
    } = body;

    // 驗證必要參數
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ 
        success: false, 
        error: '缺少必要參數：message' 
      }, { status: 400 });
    }

    // 驗證必要參數（安全版本需要更嚴格的驗證）
    if (!projectId || !projectName || !apiToken) {
      return NextResponse.json({
        success: false,
        error: '缺少必要參數: projectId, projectName, apiToken（安全模式需要專案名稱）',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    // 驗證 API Token
    if (!apiToken.startsWith('sk-')) {
      return NextResponse.json({
        success: false,
        error: '請提供有效的 OpenAI API Token（應以 sk- 開頭）',
        timestamp: new Date().toISOString(),
      }, { status: 401 });
    }

    // 生成或使用現有的對話 ID
    const currentConversationId = conversationId || `chat-agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info(`[SecureAgent API] 🔒 處理安全聊天請求: ${currentConversationId} - ${message.substring(0, 50)}...`);

    // 獲取或創建安全聊天 Agent 實例
    let secureAgent = secureAgentInstances.get(currentConversationId);
    
    if (!secureAgent) {
      // 建立新的安全聊天 Agent 配置
      const secureConfig: SecureChatAgentConfig = {
        projectName,
        dockerContainerId: containerId || process.env.DOCKER_CONTAINER_ID || 'ai-web-ide-web-test',
        conversationId: currentConversationId,
        apiToken,
        maxToolCalls,
        maxRetries,
        timeoutMs,
        enableLogging,
        enableAutoRepair,
        temperature,
        model,
      };

      // 創建新的安全聊天 Agent 實例
      secureAgent = new SecureChatAgentIntegrator(secureConfig);
      
      // 初始化安全 Agent
      await secureAgent.initialize();
      
      // 緩存實例
      secureAgentInstances.set(currentConversationId, secureAgent);
      
      logger.info(`[SecureAgent API] 🔒 新安全聊天 Agent 實例已創建: ${currentConversationId}`);
      logger.info(`[SecureAgent API] 🛡️ 安全級別: MAXIMUM - 工作目錄鎖定在: /app/workspace/${projectName}`);
    }

    // 處理用戶訊息（安全模式）
    const startTime = Date.now();
    const response = await secureAgent.processMessage(message);
    const processingTime = Date.now() - startTime;

    logger.info(`[SecureAgent API] ✅ 安全訊息處理完成: ${currentConversationId}, 耗時: ${processingTime}ms`);

    // 清理過期的實例（簡單的記憶體管理）
    if (secureAgentInstances.size > 50) {
      const oldestKey = secureAgentInstances.keys().next().value;
      if (oldestKey) {
        const oldInstance = secureAgentInstances.get(oldestKey);
        if (oldInstance) {
          oldInstance.cleanup();
        }
        secureAgentInstances.delete(oldestKey);
        logger.info(`[SecureAgent API] 🧹 清理過期安全實例: ${oldestKey}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...response,
        // 添加處理時間資訊
        agentStats: {
          ...response.agentStats,
          processingTime,
        },
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error(`[SecureAgent API] ❌ 處理安全請求時發生錯誤: ${error}`);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// GET 方法：獲取聊天 Agent 狀態和統計資訊
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const conversationId = searchParams.get('conversationId');

    switch (action) {
      case 'status':
        if (!conversationId) {
          return NextResponse.json({
            success: false,
            error: '缺少 conversationId 參數',
            timestamp: new Date().toISOString(),
          }, { status: 400 });
        }

        const secureAgent = secureAgentInstances.get(conversationId);
        if (!secureAgent) {
          return NextResponse.json({
            success: false,
            error: '找不到指定的安全聊天 Agent 實例',
            timestamp: new Date().toISOString(),
          }, { status: 404 });
        }

        const stats = secureAgent.getStats();
        const history = secureAgent.getConversationHistory();

        return NextResponse.json({
          success: true,
          data: {
            conversationId,
            stats,
            historyLength: history.length,
            isActive: true,
          },
          timestamp: new Date().toISOString(),
        });

      case 'list':
        // 列出所有活躍的安全聊天 Agent 實例
        const activeInstances = Array.from(secureAgentInstances.keys()).map(id => ({
          conversationId: id,
          stats: secureAgentInstances.get(id)?.getStats(),
        }));

        return NextResponse.json({
          success: true,
          data: {
            totalInstances: activeInstances.length,
            activeInstances,
          },
          timestamp: new Date().toISOString(),
        });

      case 'cleanup':
        // 清理所有安全實例
        let cleanedCount = 0;
        for (const [id, instance] of secureAgentInstances.entries()) {
          instance.cleanup();
          secureAgentInstances.delete(id);
          cleanedCount++;
        }

        return NextResponse.json({
          success: true,
          data: {
            message: `已清理 ${cleanedCount} 個安全聊天 Agent 實例`,
            cleanedCount,
          },
          timestamp: new Date().toISOString(),
        });

      case 'health':
        // 安全系統健康檢查
        return NextResponse.json({
          success: true,
          data: {
            status: 'healthy',
            securityLevel: 'MAXIMUM',
            activeSecureInstances: secureAgentInstances.size,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
          },
          timestamp: new Date().toISOString(),
        });

      default:
        return NextResponse.json({
          success: true,
          data: {
            message: 'SecureAgent API - 基於嚴格安全控制框架的聊天系統',
            version: '2.0.0',
            securityLevel: 'MAXIMUM',
            features: [
              '🔒 嚴格安全工具（完全容器隔離）',
              '🛡️ 路徑遍歷保護（Path traversal protection）',
              '🚫 宿主機檔案訪問防護',
              '📁 工作目錄嚴格鎖定',
              '🔍 實時安全驗證',
              '📊 安全操作日誌',
            ],
            availableActions: ['status', 'list', 'cleanup', 'health'],
            usage: {
              POST: '發送安全聊天訊息給 Agent（需要 projectName）',
              'GET?action=status&conversationId=xxx': '獲取特定安全對話狀態',
              'GET?action=list': '列出所有活躍安全實例',
              'GET?action=cleanup': '清理所有安全實例',
              'GET?action=health': '安全系統健康檢查',
            },
          },
          timestamp: new Date().toISOString(),
        });
    }

  } catch (error) {
    logger.error(`[SecureAgent API] ❌ GET 請求處理失敗: ${error}`);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// DELETE 方法：刪除特定的聊天 Agent 實例
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({
        success: false,
        error: '缺少 conversationId 參數',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    const secureAgent = secureAgentInstances.get(conversationId);
    if (!secureAgent) {
      return NextResponse.json({
        success: false,
        error: '找不到指定的安全聊天 Agent 實例',
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    // 清理安全實例
    secureAgent.cleanup();
    secureAgentInstances.delete(conversationId);

    logger.info(`[SecureAgent API] 🗑️ 已刪除安全聊天 Agent 實例: ${conversationId}`);

    return NextResponse.json({
      success: true,
      data: {
        message: `安全聊天 Agent 實例 ${conversationId} 已刪除`,
        conversationId,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error(`[SecureAgent API] ❌ DELETE 請求處理失敗: ${error}`);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

/*
ChatAgent API 使用指南

## 🎯 新特性：基於 Agent 控制框架的智能聊天

### ✅ 核心優勢
1. **智能工具決策**: AI 自動決定何時使用哪個工具
2. **先工具後分析**: 獲取資訊後再進行分析和回應
3. **完整工具支援**: 支援所有現有的 Docker 工具
4. **自動錯誤處理**: 工具失敗時自動重試或降級
5. **對話歷史管理**: 智能管理對話上下文

### 🚀 基本使用

```typescript
const response = await fetch('/api/chat-agent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: '請幫我檢查專案狀態並啟動開發伺服器',
    projectId: 'my-project-123',
    projectName: 'My Project',
    apiToken: 'sk-...',
    enableLogging: true,
  })
});

const result = await response.json();
console.log(result.data.message); // AI 智能回應
console.log(result.data.agentStats); // Agent 執行統計
```

### 🔧 進階配置

```typescript
const advancedConfig = {
  message: '分析專案並修復任何問題',
  projectId: 'my-project-123',
  projectName: 'My Project',
  apiToken: 'sk-...',
  
  // Agent 控制配置
  maxToolCalls: 10,        // 最大工具呼叫次數
  maxRetries: 3,           // 最大重試次數
  timeoutMs: 60000,        // 超時時間（60秒）
  enableLogging: true,     // 啟用詳細日誌
  
  // AI 模型配置
  temperature: 0.1,        // 創造性（0-1）
  model: 'gpt-4o',         // 使用的模型
  
  // 實驗性功能
  enableAutoRepair: true,  // 啟用自動修復模式
};
```

### 📊 狀態查詢

```typescript
// 獲取特定對話狀態
const status = await fetch('/api/chat-agent?action=status&conversationId=xxx');

// 列出所有活躍實例
const list = await fetch('/api/chat-agent?action=list');

// 健康檢查
const health = await fetch('/api/chat-agent?action=health');
```

### 🛠️ 支援的工具

Agent 自動支援以下工具類別：
- **開發伺服器管理**: 啟動、重啟、狀態檢查
- **日誌監控**: 讀取日誌、搜尋錯誤
- **健康檢查**: 容器健康、網路連通性
- **檔案系統**: 列出、創建、刪除檔案
- **容器管理**: 執行命令、容器操作

### 💡 智能工作流程

1. **用戶發送訊息** → AI 分析需求
2. **智能工具選擇** → 根據需求選擇合適工具
3. **工具執行** → 獲取實際資訊
4. **結果分析** → 基於工具結果進行分析
5. **智能回應** → 提供有用的回應和建議

這樣 AI 就能真正「看到」專案狀態，而不是憑空猜測！
*/ 