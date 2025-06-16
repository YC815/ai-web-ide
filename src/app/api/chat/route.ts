import { NextRequest, NextResponse } from 'next/server';
import { createAIProjectAssistant } from './ai-project-assistant';

export interface ChatRequest {
  message: string;
  projectId: string;
  projectName?: string;
  conversationId?: string;
  useFullPrompt?: boolean; // 是否使用完整提示詞（預設為 true）
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

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  try {
    const body: ChatRequest = await request.json();
    const { message, projectId, projectName, conversationId, useFullPrompt = true, apiToken } = body;

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
        containerStatus: 'running' // 這裡應該從實際容器狀態獲取
      });
      conversationInstances.set(currentConversationId, assistant);
    }

    console.log(`🤖 處理對話 ${currentConversationId} 的訊息:`, message);

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
        intent: 'auto-detected' // 這裡可以加入更詳細的意圖分析
      };

      console.log('📋 完整提示詞資訊:', promptInfo);
      console.log('🔍 提示詞預覽 (前500字):', fullPrompt.substring(0, 500) + '...');
    } else if (assistant) {
      // 使用簡化版本（性能優化）
      fullPrompt = await assistant.buildSimplifiedPromptForMessage(message);
      promptInfo = {
        promptLength: fullPrompt.length,
        hasProjectContext: false,
        historyLength: 0,
        intent: 'simplified'
      };
    } else {
      // 如果 assistant 不存在，使用基本提示詞
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

    // 在實際應用中，這裡會將 fullPrompt 發送給 AI 模型
    // 例如：const aiResponse = await sendToOpenAI(fullPrompt);
    console.log('🚀 準備發送給 AI 的完整提示詞已構建完成');

    // 清理過期的對話實例（簡單的記憶體管理）
    if (conversationInstances.size > 100) {
      const oldestKey = conversationInstances.keys().next().value;
      if (oldestKey) {
        conversationInstances.delete(oldestKey);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: response.message,
        conversationId: currentConversationId,
        projectReport: response.projectReport,
        suggestions: response.suggestions,
        actionsTaken: response.actionsTaken,
        needsUserInput: response.needsUserInput,
        promptInfo
      }
    });

  } catch (error) {
    console.error('聊天 API 錯誤:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    }, { status: 500 });
  }
}

// GET 方法：獲取對話狀態或提示詞預覽
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const action = searchParams.get('action');
    const projectId = searchParams.get('projectId');

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
          } : null
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
使用範例和說明（保留供未來參考）

# 聊天 API 使用指南

## 🎯 核心特色：動態 Prompt 構建

每次用戶發送訊息時，API 都會：
1. 🔍 獲取最新的專案狀態
2. 📋 構建完整的對話上下文
3. 🤖 生成包含所有必要資訊的系統提示詞
4. 🚀 確保 AI 獲得最完整的上下文

## 📡 API 端點

### POST /api/chat
發送聊天訊息

```typescript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: '目前專案有哪些檔案？',
    projectId: 'ai-web-ide-my-project-123456',
    projectName: 'My Project',
    conversationId: 'conv_123', // 可選，用於維持對話狀態
    useFullPrompt: true // 預設為 true，使用完整提示詞
  })
});

const result = await response.json();
console.log(result.data.message); // AI 回應
console.log(result.data.promptInfo); // 提示詞資訊
```

### GET /api/chat?action=preview-prompt
預覽提示詞內容

```typescript
const response = await fetch('/api/chat?action=preview-prompt&projectId=123&message=測試');
const result = await response.json();

console.log('完整提示詞長度:', result.data.fullPrompt.length);
console.log('簡化提示詞長度:', result.data.simplifiedPrompt.length);
console.log('壓縮比例:', result.data.comparison.compressionRatio);
```

## 🎛️ 提示詞模式

### 完整模式 (useFullPrompt: true)
- ✅ 包含完整專案上下文
- ✅ 包含對話歷史
- ✅ 包含工具選擇指導
- ✅ 包含錯誤上下文
- ⚠️ 提示詞較長，但 AI 回應更精準

### 簡化模式 (useFullPrompt: false)  
- ✅ 基本系統提示詞
- ✅ 當前專案狀態
- ✅ 用戶意圖分析
- ⚡ 提示詞較短，回應速度更快

## 💡 最佳實踐

1. **開發階段**：使用完整模式獲得最佳 AI 回應
2. **生產環境**：根據性能需求選擇模式
3. **調試時**：使用預覽功能檢查提示詞內容
4. **長對話**：定期清理對話實例避免記憶體洩漏

這樣每次對話 AI 都能獲得最新、最完整的專案上下文！
*/ 