import { NextRequest, NextResponse } from 'next/server';
import { createAIProjectAssistant } from './ai-project-assistant';

export interface ChatRequest {
  message: string;
  projectId: string;
  projectName?: string;
  conversationId?: string;
  useFullPrompt?: boolean; // 是否使用完整提示詞（預設為 true）
  autoRepairMode?: boolean; // 是否啟用自動修正模式
  apiToken?: string; // OpenAI API Token
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
      thoughtProcess: any;
      repairAttempts: number;
      completionStatus: string;
      riskAssessment: any;
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
      conversationId, 
      useFullPrompt = true, 
      autoRepairMode = false,
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

    // 獲取或創建 AI 助理實例
    let assistant = conversationInstances.get(currentConversationId);
    if (!assistant) {
      assistant = createAIProjectAssistant({
        projectId,
        projectName: projectName || 'Unknown Project',
        containerStatus: 'running'
      });
      conversationInstances.set(currentConversationId, assistant);
    }

    console.log(`🤖 處理對話 ${currentConversationId} 的訊息:`, message, `(自動修正: ${autoRepairMode})`);

    let responseData;

    if (autoRepairMode) {
      // 自動修正模式處理
      responseData = await handleAutoRepairMode(
        assistant,
        currentConversationId,
        message,
        useFullPrompt
      );
    } else {
      // 一般模式處理
      responseData = await handleNormalMode(
        assistant,
        currentConversationId,
        message,
        useFullPrompt
      );
    }

    // 清理過期的對話實例（簡單的記憶體管理）
    if (conversationInstances.size > 100) {
      const oldestKey = conversationInstances.keys().next().value;
      if (oldestKey) {
        conversationInstances.delete(oldestKey);
        autoRepairStates.delete(oldestKey);
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

// 自動修正模式處理邏輯
async function handleAutoRepairMode(
  assistant: ReturnType<typeof createAIProjectAssistant>,
  conversationId: string,
  message: string,
  useFullPrompt: boolean
) {
  // 初始化或取得自動修正狀態
  let autoRepairState = autoRepairStates.get(conversationId);
  if (!autoRepairState) {
    autoRepairState = {
      isEnabled: true,
      currentTask: message,
      repairAttempts: 0,
      maxRepairAttempts: 3,
      thoughtProcesses: [],
      completionStatus: 'in_progress'
    };
    autoRepairStates.set(conversationId, autoRepairState);
  }

  let totalActionsTaken: string[] = [];
  let finalResponse = '';
  let currentMessage = message;

  // 自動修正循環
  while (autoRepairState.completionStatus === 'in_progress' && 
         autoRepairState.repairAttempts < autoRepairState.maxRepairAttempts) {
    
    try {
      console.log(`🔄 自動修正循環 #${autoRepairState.repairAttempts + 1}: ${conversationId}`);

      // Step 1: 輸出思考過程
      const thoughtProcess = await generateThoughtProcess(assistant, currentMessage, autoRepairState);
      autoRepairState.thoughtProcesses.push(thoughtProcess);

      // Step 2: 執行任務
      const response = await executeTask(assistant, currentMessage, useFullPrompt);
      finalResponse = response.message;
      totalActionsTaken.push(...(response.actionsTaken || []));

      // Step 3: 分析結果並判斷是否需要修正
      const needsRepair = await analyzeResponseForRepair(response, autoRepairState);

      if (!needsRepair.shouldRepair) {
        // 任務完成
        autoRepairState.completionStatus = 'completed';
        finalResponse = `✅ 此次任務已完成！${finalResponse}`;
        console.log(`✅ 自動修正完成: ${conversationId}`);
        break;
      }

      if (needsRepair.riskLevel === 'high') {
        // 高風險，需要用戶介入
        autoRepairState.completionStatus = 'awaiting_user';
        finalResponse = `🔍 等待使用者回覆 - ${needsRepair.reason}\n\n${finalResponse}`;
        console.log(`⚠️ 需要用戶介入: ${conversationId} - ${needsRepair.reason}`);
        break;
      }

      // Step 4: 準備下一輪修正
      autoRepairState.repairAttempts++;
      autoRepairState.lastError = needsRepair.reason;
      currentMessage = generateRepairPrompt(needsRepair, autoRepairState);
      
      console.log(`🔧 準備第 ${autoRepairState.repairAttempts} 次修正: ${needsRepair.reason}`);

    } catch (error) {
      console.error(`❌ 自動修正循環錯誤:`, error);
      autoRepairState.repairAttempts++;
      autoRepairState.lastError = error instanceof Error ? error.message : '未知錯誤';
      
      if (autoRepairState.repairAttempts >= autoRepairState.maxRepairAttempts) {
        autoRepairState.completionStatus = 'failed';
        finalResponse = `⚠️ 自動修正失敗 - 經過 ${autoRepairState.maxRepairAttempts} 次嘗試仍無法解決問題，需要人為介入。`;
      }
    }
  }

  // 構建自動修正結果
  return {
    message: finalResponse,
    conversationId,
    actionsTaken: totalActionsTaken,
    needsUserInput: autoRepairState.completionStatus === 'awaiting_user',
    autoRepairMode: true,
    autoRepairResult: {
      thoughtProcess: autoRepairState.thoughtProcesses[autoRepairState.thoughtProcesses.length - 1],
      repairAttempts: autoRepairState.repairAttempts,
      completionStatus: autoRepairState.completionStatus,
      riskAssessment: {
        level: autoRepairState.repairAttempts >= 2 ? 'medium' : 'low',
        concerns: autoRepairState.lastError ? [autoRepairState.lastError] : []
      },
      nextSteps: generateNextSteps(autoRepairState)
    }
  };
}

// 一般模式處理邏輯
async function handleNormalMode(
  assistant: ReturnType<typeof createAIProjectAssistant>,
  conversationId: string,
  message: string,
  useFullPrompt: boolean
) {
  // 根據設定選擇使用完整或簡化提示詞
  let fullPrompt: string;
  let promptInfo: {
    promptLength: number;
    hasProjectContext: boolean;
    historyLength: number;
    intent: string;
  } = {
    promptLength: 0,
    hasProjectContext: false,
    historyLength: 0,
    intent: 'unknown'
  };

  if (useFullPrompt && assistant) {
    // 🎯 關鍵：每次對話都重新構建完整的系統提示詞
    fullPrompt = await assistant.buildFullPromptForMessage(message);
    
    // 獲取提示詞資訊用於調試
    const projectSnapshot = await assistant.getCurrentProjectSnapshot();
    const conversationHistory = assistant.getConversationHistory();
    
    promptInfo = {
      promptLength: fullPrompt.length,
      hasProjectContext: !!projectSnapshot,
      historyLength: conversationHistory.length,
      intent: 'auto-detected'
    };

    console.log('📋 完整提示詞資訊:', promptInfo);
    console.log('🔍 提示詞預覽 (前500字):', fullPrompt.substring(0, 500) + '...');
  } else if (assistant) {
    fullPrompt = await assistant.buildSimplifiedPromptForMessage(message);
    promptInfo = {
      promptLength: fullPrompt.length,
      hasProjectContext: false,
      historyLength: 0,
      intent: 'simplified'
    };
  } else {
    fullPrompt = `用戶訊息：${message}`;
    promptInfo = {
      promptLength: fullPrompt.length,
      hasProjectContext: false,
      historyLength: 0,
      intent: 'basic'
    };
  }

  // 處理用戶訊息
  const response = assistant ? await assistant.processUserMessage(message) : {
    message: '抱歉，AI 助理暫時無法使用。',
    projectReport: undefined,
    suggestions: [],
    actionsTaken: [],
    needsUserInput: false
  };

  console.log('🚀 準備發送給 AI 的完整提示詞已構建完成');

  return {
    message: response.message,
    conversationId,
    projectReport: response.projectReport,
    suggestions: response.suggestions,
    actionsTaken: response.actionsTaken,
    needsUserInput: response.needsUserInput,
    autoRepairMode: false,
    promptInfo
  };
}

// 生成思考過程
async function generateThoughtProcess(
  assistant: ReturnType<typeof createAIProjectAssistant>,
  message: string,
  autoRepairState: AutoRepairState
) {
  return {
    timestamp: new Date().toISOString(),
    phase: autoRepairState.repairAttempts === 0 ? 'analysis' : 'error_handling',
    content: `🧠 THINKING: 分析任務「${message}」`,
    reasoning: autoRepairState.repairAttempts === 0 
      ? '首次處理，進行任務分析和規劃'
      : `第 ${autoRepairState.repairAttempts + 1} 次修正嘗試，上次錯誤：${autoRepairState.lastError}`,
    issues: autoRepairState.lastError ? [autoRepairState.lastError] : []
  };
}

// 執行任務
async function executeTask(
  assistant: ReturnType<typeof createAIProjectAssistant>,
  message: string,
  useFullPrompt: boolean
) {
  console.log('⚡ ACTION: 執行任務...');
  return await assistant.processUserMessage(message);
}

// 分析回應是否需要修正
async function analyzeResponseForRepair(
  response: any,
  autoRepairState: AutoRepairState
): Promise<{
  shouldRepair: boolean;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high';
}> {
  // 檢查是否有錯誤
  if (response.error) {
    return {
      shouldRepair: true,
      reason: `檢測到錯誤：${response.error}`,
      riskLevel: 'medium'
    };
  }

  // 檢查回應內容是否表示有問題
  const responseText = response.message.toLowerCase();
  if (responseText.includes('錯誤') || responseText.includes('失敗') || responseText.includes('無法')) {
    return {
      shouldRepair: true,
      reason: 'AI 回應中提到了錯誤或問題',
      riskLevel: autoRepairState.repairAttempts >= 1 ? 'high' : 'medium'
    };
  }

  // 檢查是否需要用戶輸入但沒有明確完成
  if (response.needsUserInput && !responseText.includes('完成')) {
    return {
      shouldRepair: false,
      reason: '需要用戶進一步輸入',
      riskLevel: 'low'
    };
  }

  return {
    shouldRepair: false,
    reason: '任務執行正常',
    riskLevel: 'low'
  };
}

// 生成修正提示
function generateRepairPrompt(
  needsRepair: { reason: string },
  autoRepairState: AutoRepairState
): string {
  return `請根據以下問題進行自動修正：

🔍 **檢測到的問題**：${needsRepair.reason}

🎯 **修正目標**：解決上述問題並完成原始任務

⚡ **請主動**：
1. 分析問題根因
2. 制定修正策略  
3. 執行修正操作
4. 驗證修正結果

原始任務：${autoRepairState.currentTask}`;
}

// 生成下一步建議
function generateNextSteps(autoRepairState: AutoRepairState): string[] {
  const steps = [];
  
  switch (autoRepairState.completionStatus) {
    case 'completed':
      steps.push('任務已完成，可以繼續下一個任務');
      break;
    case 'awaiting_user':
      steps.push('請檢查修正結果');
      steps.push('確認是否需要進一步調整');
      steps.push('或提供更多資訊以繼續自動修正');
      break;
    case 'failed':
      steps.push('檢查錯誤日誌');
      steps.push('考慮手動解決問題');
      steps.push('或重新描述需求');
      break;
    default:
      steps.push('自動修正進行中...');
  }
  
  return steps;
}

// GET 方法：獲取對話狀態或提示詞預覽
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const action = searchParams.get('action');
    const projectId = searchParams.get('projectId');

    if (action === 'repair-status' && conversationId) {
      // 獲取自動修正狀態
      const autoRepairState = autoRepairStates.get(conversationId);
      
      if (!autoRepairState) {
        return NextResponse.json({
          success: false,
          error: '找不到自動修正會話'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: {
          conversationId,
          isAutoRepairMode: autoRepairState.isEnabled,
          currentTask: autoRepairState.currentTask,
          repairAttempts: autoRepairState.repairAttempts,
          maxRepairAttempts: autoRepairState.maxRepairAttempts,
          completionStatus: autoRepairState.completionStatus,
          thoughtProcessCount: autoRepairState.thoughtProcesses.length,
          lastError: autoRepairState.lastError
        }
      });
    }

    if (action === 'preview-prompt' && projectId) {
      // 預覽提示詞功能
      const message = searchParams.get('message') || '測試訊息';
      
      const assistant = createAIProjectAssistant({
        projectId,
        projectName: 'Preview Project',
        containerStatus: 'running'
      });

      const fullPrompt = await assistant.buildFullPromptForMessage(message);
      const simplifiedPrompt = await assistant.buildSimplifiedPromptForMessage(message);

      return NextResponse.json({
        success: true,
        data: {
          fullPrompt: {
            content: fullPrompt,
            length: fullPrompt.length
          },
          simplifiedPrompt: {
            content: simplifiedPrompt,
            length: simplifiedPrompt.length
          },
          comparison: {
            lengthDifference: fullPrompt.length - simplifiedPrompt.length,
            compressionRatio: (simplifiedPrompt.length / fullPrompt.length * 100).toFixed(1) + '%'
          }
        }
      });
    }

    if (conversationId && conversationInstances.has(conversationId)) {
      const assistant = conversationInstances.get(conversationId);
      if (!assistant) {
        return NextResponse.json({
          success: false,
          error: '對話實例不存在'
        }, { status: 404 });
      }
      
      const history = assistant.getConversationHistory();
      const projectSnapshot = await assistant.getCurrentProjectSnapshot();

      return NextResponse.json({
        success: true,
        data: {
          conversationId,
          historyLength: history.length,
          hasProjectContext: !!projectSnapshot,
          projectInfo: projectSnapshot ? {
            name: projectSnapshot.projectInfo.name,
            type: projectSnapshot.projectInfo.type,
            isInitialized: projectSnapshot.projectInfo.isInitialized
          } : null,
          autoRepairState: autoRepairStates.get(conversationId)
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: '找不到指定的對話或缺少必要參數'
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
      autoRepairStates.delete(conversationId); // 同時清理自動修正狀態
      
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