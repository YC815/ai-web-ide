import { NextRequest, NextResponse } from 'next/server';
import { createAIProjectAssistant } from './ai-project-assistant';
// @deprecated LangchainChatEngine 已棄用，請使用新的 aiChatSession
import { createLangChainChatEngine, showMigrationWarning } from '../../../lib/ai/langchain-chat-engine';

// 專案名稱標準化函數 - 將前端的專案名稱映射到容器內的實際目錄名稱
function normalizeProjectName(projectName: string, containerId?: string): string {
  // 如果有容器 ID，嘗試從容器名稱提取正確的專案名稱
  if (containerId && containerId.includes('ai-web-ide-')) {
    const match = containerId.match(/^ai-web-ide-(.+?)-\d+$/);
    if (match) {
      // 將短橫線轉換為底線，這是容器內實際的目錄格式
      return match[1].replace(/-/g, '_');
    }
  }
  
  // 如果無法從容器 ID 提取，則標準化專案名稱
  return projectName
    .toLowerCase()
    .replace(/\s+/g, '_')  // 空格轉為底線
    .replace(/-/g, '_');   // 短橫線轉為底線
}

export interface ChatRequest {
  message: string;
  projectId: string;
  projectName?: string;
  containerId?: string; // Docker 容器 ID
  conversationId?: string;
  useFullPrompt?: boolean; // 是否使用完整提示詞（預設為 true）
  autoRepairMode?: boolean; // 是否啟用自動修正模式
  useLangchain?: boolean; // 是否使用新的 Langchain 引擎（預設為 true）
  apiToken?: string; // OpenAI API Token
}

// 定義思考過程介面
interface ThoughtProcess {
  timestamp: string;
  phase: string;
  content: string;
  reasoning: string;
  issues: string[];
}

// 定義風險評估介面
interface RiskAssessment {
  level: 'low' | 'medium' | 'high';
  concerns: string[];
}

export interface ChatResponse {
  success: boolean;
  data?: {
    message: string;
    conversationId: string;
    projectReport?: string;
    suggestions?: string[];
    actionsTaken?: string[];
    needsUserInput?: boolean;
    autoRepairMode?: boolean;
    autoRepairResult?: {
      thoughtProcess: ThoughtProcess;
      repairAttempts: number;
      completionStatus: string;
      riskAssessment: RiskAssessment;
      nextSteps: string[];
    };
    promptInfo?: {
      promptLength: number;
      hasProjectContext: boolean;
      historyLength: number;
      intent: string;
    };
  };
  error?: string;
}

// 儲存對話實例的 Map（實際應用中應使用 Redis 或資料庫）
const conversationInstances = new Map<string, ReturnType<typeof createAIProjectAssistant>>();

// Langchain 引擎實例管理
const langchainEngines = new Map<string, ReturnType<typeof createLangChainChatEngine>>();

// 自動修正會話狀態管理
interface AutoRepairState {
  isEnabled: boolean;
  currentTask: string;
  repairAttempts: number;
  maxRepairAttempts: number;
  lastError?: string;
  thoughtProcesses: Array<{
    timestamp: string;
    phase: string;
    content: string;
    reasoning: string;
    issues: string[];
  }>;
  completionStatus: 'in_progress' | 'completed' | 'failed' | 'awaiting_user';
}

const autoRepairStates = new Map<string, AutoRepairState>();

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  try {
    const body: ChatRequest = await request.json();
    const { 
      message, 
      projectId, 
      projectName, 
      containerId,
      conversationId, 
      useFullPrompt = true, 
      autoRepairMode = false,
      useLangchain = true,  // 預設使用 Langchain 引擎
      apiToken 
    } = body;

    // 驗證必要參數
    if (!message || !projectId) {
      return NextResponse.json({
        success: false,
        error: '缺少必要參數: message 和 projectId'
      }, { status: 400 });
    }

    // 驗證 API Token
    if (!apiToken || !apiToken.startsWith('sk-')) {
      return NextResponse.json({
        success: false,
        error: '請提供有效的 OpenAI API Token。請在聊天介面中點擊「設定 Token」按鈕。'
      }, { status: 401 });
    }

    // 生成或使用現有的對話 ID
    const currentConversationId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`🤖 處理對話 ${currentConversationId} 的訊息:`, message, `(Langchain: ${useLangchain}, 自動修正: ${autoRepairMode})`);

    let responseData;

    if (useLangchain) {
      // 使用新的 Langchain 引擎
      const engineKey = `${projectId}_${apiToken.substring(0, 10)}`;
      let chatEngine = langchainEngines.get(engineKey);
      
      if (!chatEngine) {
        console.log(`🚀 創建新的 Langchain 聊天引擎: ${engineKey}`);
        chatEngine = await createLangChainChatEngine([], normalizedProjectName);
        langchainEngines.set(engineKey, chatEngine);
      }

      // 標準化專案名稱以匹配容器內的實際目錄結構
      const normalizedProjectName = normalizeProjectName(projectName || projectId, containerId);
      
      // 建構專案上下文
      const projectContext = {
        projectId,
        projectName: normalizedProjectName, // 使用標準化的專案名稱
        containerId: containerId || `ai-web-ide-${projectName || projectId}`, // 使用更智能的容器 ID 推導
        containerStatus: 'running' as const
      };
      
      console.log(`🔧 專案名稱標準化: "${projectName}" -> "${normalizedProjectName}" (容器: ${containerId})`);;

      // 使用 Langchain 引擎處理訊息
      const langchainResponse = await chatEngine.run(message);

      responseData = {
        message: langchainResponse,
        conversationId: currentConversationId,
        projectReport: undefined,
        suggestions: undefined,
        actionsTaken: undefined,
        needsUserInput: false,
        autoRepairMode: false
      };
    } else {
      // 使用原有的 AI 助理系統
      let assistant = conversationInstances.get(currentConversationId);
      if (!assistant) {
        assistant = createAIProjectAssistant({
          projectId,
          projectName: projectName || 'Unknown Project',
          containerStatus: 'running'
        });
        conversationInstances.set(currentConversationId, assistant);
      }

      if (autoRepairMode) {
        // 啟用自動修正模式
        assistant.setAutoRepairMode(true, 3);
        
        // 直接處理用戶訊息，自動修正會在內部處理
        const response = await assistant.processUserMessage(message);
        
        responseData = {
          message: response.message,
          conversationId: currentConversationId,
          projectReport: response.projectReport,
          suggestions: response.suggestions,
          actionsTaken: response.actionsTaken,
          needsUserInput: response.needsUserInput,
          autoRepairMode: true,
          autoRepairResult: response.autoRepairResult
        };
      } else {
        // 一般模式處理
        responseData = await handleNormalMode(
          assistant,
          currentConversationId,
          message,
          useFullPrompt
        );
      }
    }

    // 清理過期的對話實例（簡單的記憶體管理）
    if (conversationInstances.size > 100) {
      const oldestKey = conversationInstances.keys().next().value;
      if (oldestKey) {
        conversationInstances.delete(oldestKey);
        autoRepairStates.delete(oldestKey);
      }
    }

    // 清理過期的 Langchain 引擎
    if (langchainEngines.size > 50) {
      const oldestEngineKey = langchainEngines.keys().next().value;
      if (oldestEngineKey) {
        langchainEngines.delete(oldestEngineKey);
        console.log(`🧹 清理舊的 Langchain 引擎: ${oldestEngineKey}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('聊天 API 錯誤:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    }, { status: 500 });
  }
}

// 一般模式處理邏輯（簡化版）
async function handleNormalMode(
  assistant: ReturnType<typeof createAIProjectAssistant>,
  conversationId: string,
  message: string,
  _useFullPrompt: boolean // 標記為未使用，但保留接口相容性
) {
  // 確保自動修正模式被停用
  assistant.setAutoRepairMode(false);
  
  // 處理用戶訊息
  const response = await assistant.processUserMessage(message);

  return {
    message: response.message,
    conversationId,
    projectReport: response.projectReport,
    suggestions: response.suggestions,
    actionsTaken: response.actionsTaken,
    needsUserInput: response.needsUserInput,
    autoRepairMode: false
  };
}

// GET 方法：獲取對話狀態
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (conversationId && conversationInstances.has(conversationId)) {
      const assistant = conversationInstances.get(conversationId);
      if (!assistant) {
        return NextResponse.json({
          success: false,
          error: '對話實例不存在'
        }, { status: 404 });
      }
      
      const history = assistant.getConversationHistory();
      const autoRepairStatus = assistant.getAutoRepairStatus();

      return NextResponse.json({
        success: true,
        data: {
          conversationId,
          historyLength: history.length,
          autoRepairStatus
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: '找不到指定的對話'
    }, { status: 404 });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    }, { status: 500 });
  }
}

// DELETE 方法：清理對話
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (conversationId && conversationInstances.has(conversationId)) {
      conversationInstances.delete(conversationId);
      autoRepairStates.delete(conversationId);
      
      return NextResponse.json({
        success: true,
        data: { message: '對話已清理' }
      });
    }

    return NextResponse.json({
      success: false,
      error: '找不到指定的對話'
    }, { status: 404 });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    }, { status: 500 });
  }
}

/*
使用範例和說明（擴展支援自動修正模式）

# 聊天 API 使用指南 - 自動修正模式

## 🎯 核心特色：自動修正模式（Auto Repair Mode）

### 🔧 啟用自動修正模式

```typescript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: '創建一個登入頁面',
    projectId: 'ai-web-ide-my-project-123456',
    projectName: 'My Project',
    conversationId: 'conv_123',
    autoRepairMode: true, // 🔧 啟用自動修正模式
    useFullPrompt: true,
    apiToken: 'sk-...'
  })
});

const result = await response.json();
console.log(result.data.message); // AI 回應
console.log(result.data.autoRepairResult); // 自動修正結果
```

### 🔄 自動修正工作流程

1. **思考輸出**：AI 先輸出完整的思考分析
2. **執行任務**：使用工具執行用戶請求
3. **結果驗證**：自動分析執行結果和錯誤
4. **自動修正**：如發現問題，自動進行修正
5. **循環檢查**：重複步驟直到完成或需要用戶介入
6. **完成宣告**：明確告知任務狀態

### 📊 自動修正狀態查詢

```typescript
const statusResponse = await fetch('/api/chat?action=repair-status&conversationId=conv_123');
const status = await statusResponse.json();

console.log('修正狀態:', status.data.completionStatus);
console.log('修正次數:', status.data.repairAttempts);
console.log('思考過程:', status.data.thoughtProcessCount);
```

## 🛡️ 風險控管機制

- **最大修正次數**：預設 3 次，防止無限循環
- **風險等級評估**：低/中/高風險自動判斷
- **用戶介入觸發**：高風險操作主動請求確認
- **錯誤追蹤**：完整記錄修正過程和錯誤

## 💡 使用建議

1. **開發階段**：啟用自動修正模式，減少來回溝通
2. **複雜任務**：讓 AI 自動處理錯誤和異常情況
3. **狀態監控**：定期查詢修正狀態，了解進度
4. **風險管理**：高風險操作時，AI 會主動請求確認

這樣 AI 就能真正「自動修正」，持續工作直到任務完成！
*/ 