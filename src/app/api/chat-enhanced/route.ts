// 增強的聊天 API 路由
// 整合 SQLite 儲存和完整的上下文管理功能
import { NextRequest, NextResponse } from 'next/server';
import { chatContextManager } from '@/lib/chat/chat-context-manager';
import { createLangChainChatEngine, ProjectContext } from '@/lib/ai/langchain-chat-engine';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { extractProjectFromUrl } from '@/lib/docker/docker-context-config';

// 工具調用記錄介面
export interface ToolCallRecord {
  id: string;
  roomId: string;
  messageId: string;
  toolName: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  success: boolean;
  duration: number;
  timestamp: string;
  errorMessage?: string;
}

// 思考過程記錄介面
export interface ThoughtProcessRecord {
  id: string;
  roomId: string;
  messageId: string;
  reasoning: string;
  decision: 'continue_tools' | 'respond_to_user' | 'need_input';
  confidence: number;
  contextUsed: string[];
  decisionFactors: string[];
  timestamp: string;
}

// 請求介面
export interface EnhancedChatRequest {
  message?: string; // 對於創建房間操作，message 是可選的
  action?: 'create_room' | 'send_message'; // 操作類型
  roomId?: string; // 聊天室 ID，如果不提供則創建新的
  projectId?: string; // 改為可選，優先從 URL 提取
  projectName?: string; // 改為可選，優先從 URL 提取
  containerId?: string;
  apiToken: string;
  
  // 新增：前端 URL 或路由資訊
  url?: string; // 前端當前 URL
  referer?: string; // HTTP Referer
  pathname?: string; // Next.js 路由路徑
  
  // 可選配置
  model?: string;
  temperature?: number;
  maxTokens?: number;
  contextLength?: number; // 上下文長度
}

// 回應介面
export interface EnhancedChatResponse {
  success: boolean;
  data?: {
    message: string;
    messageId: string;
    roomId: string;
    tokens?: number;
    cost?: number;
    toolCallsExecuted?: number;
    contextUsed: string; // 使用的上下文內容
    toolCalls?: ToolCallRecord[]; // 工具調用記錄
    thoughtProcess?: ThoughtProcessRecord; // 思考過程記錄
    projectContext?: ProjectContext; // 使用的專案上下文
    stats?: {
      totalCalls: number;
      successfulCalls: number;
      failedCalls: number;
      averageExecutionTime: number;
      toolUsage: Record<string, number>;
    };
  };
  error?: string;
}

// Langchain 引擎實例管理（按專案上下文組合）
const chatEngines = new Map<string, ReturnType<typeof createLangChainChatEngine>>();

/**
 * 從請求中提取專案上下文
 */
function extractProjectContextFromRequest(request: NextRequest, body: EnhancedChatRequest): ProjectContext {
  const context: ProjectContext = {};
  
  // 1. 優先使用請求體中的 URL
  if (body.url) {
    context.url = body.url;
    console.log(`📍 從請求體獲取 URL: ${body.url}`);
  }
  
  // 2. 從 HTTP Referer 獲取 URL
  else if (body.referer || request.headers.get('referer')) {
    const refererUrl = body.referer || request.headers.get('referer');
    if (refererUrl) {
      context.url = refererUrl;
      console.log(`📍 從 Referer 獲取 URL: ${refererUrl}`);
    }
  }
  
  // 3. 如果有路徑資訊，構建 URL
  else if (body.pathname) {
    const origin = request.headers.get('origin') || 'http://localhost:3000';
    context.url = `${origin}${body.pathname}`;
    console.log(`📍 從路徑構建 URL: ${context.url}`);
  }
  
  // 4. 如果有明確的專案 ID 或名稱，使用這些
  if (body.projectId) {
    context.projectId = body.projectId;
    console.log(`📍 從請求體獲取專案 ID: ${body.projectId}`);
  }
  
  if (body.projectName) {
    context.projectName = body.projectName;
    console.log(`📍 從請求體獲取專案名稱: ${body.projectName}`);
  }
  
  if (body.containerId) {
    context.containerId = body.containerId;
    console.log(`📍 從請求體獲取容器 ID: ${body.containerId}`);
  }
  
  // 5. 如果有 URL，嘗試從中提取專案資訊
  if (context.url && !context.projectId) {
    const projectId = extractProjectFromUrl(context.url);
    if (projectId) {
      context.projectId = projectId;
      console.log(`📍 從 URL 提取專案 ID: ${projectId}`);
    }
  }
  
  console.log(`📍 最終專案上下文:`, context);
  return context;
}

/**
 * 生成引擎快取鍵
 */
function generateEngineKey(context: ProjectContext, apiToken: string): string {
  const parts: string[] = [];
  
  if (context.projectId) parts.push(`id:${context.projectId}`);
  if (context.projectName) parts.push(`name:${context.projectName}`);
  if (context.containerId) parts.push(`container:${context.containerId.substring(0, 12)}`);
  if (context.url) {
    const projectFromUrl = extractProjectFromUrl(context.url);
    if (projectFromUrl) parts.push(`url:${projectFromUrl}`);
  }
  
  parts.push(`token:${apiToken.substring(0, 10)}`);
  
  return parts.join('_');
}

/**
 * 獲取或創建 Langchain 引擎
 */
async function getOrCreateChatEngine(
  context: ProjectContext, 
  apiToken: string
): Promise<ReturnType<typeof createLangChainChatEngine>> {
  const engineKey = generateEngineKey(context, apiToken);
  
  if (!chatEngines.has(engineKey)) {
    console.log(`🚀 創建新的 Langchain 引擎: ${engineKey}`);
    console.log(`🔧 使用專案上下文:`, context);
    const engine = await createLangChainChatEngine(context);
    chatEngines.set(engineKey, engine);
  }
  
  return chatEngines.get(engineKey)!;
}

/**
 * 生成唯一 ID
 */
function generateId(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * 記錄工具調用到資料庫
 */
async function recordToolCalls(
  roomId: string, 
  messageId: string, 
  toolCalls: Array<Record<string, unknown>>
): Promise<ToolCallRecord[]> {
  const records: ToolCallRecord[] = [];
  
  for (const toolCall of toolCalls || []) {
    const record: ToolCallRecord = {
      id: generateId('tool'),
      roomId,
      messageId,
      toolName: toolCall.tool || 'unknown',
      input: toolCall.input || {},
      output: toolCall.output || {},
      success: toolCall.success || false,
      duration: toolCall.duration || 0,
      timestamp: new Date().toISOString(),
      errorMessage: toolCall.error,
    };
    
    // 記錄到上下文管理器
    await chatContextManager.recordToolUsage(
      roomId,
      record.toolName,
      record.input,
      {
        output: record.output,
        success: record.success,
        duration: record.duration,
        errorMessage: record.errorMessage,
      },
      record.success
    );
    
    records.push(record);
    console.log(`🔧 記錄工具調用: ${record.toolName} (${record.success ? '成功' : '失敗'})`);
  }
  
  return records;
}

/**
 * 記錄思考過程到資料庫
 */
async function recordThoughtProcess(
  roomId: string,
  messageId: string,
  thoughtProcess: Record<string, unknown> | undefined
): Promise<ThoughtProcessRecord | undefined> {
  if (!thoughtProcess) return undefined;
  
  const record: ThoughtProcessRecord = {
    id: generateId('thought'),
    roomId,
    messageId,
    reasoning: thoughtProcess.reasoning || '',
    decision: thoughtProcess.decision || 'respond_to_user',
    confidence: thoughtProcess.confidence || 0,
    contextUsed: thoughtProcess.contextUsed || [],
    decisionFactors: thoughtProcess.decisionFactors || [],
    timestamp: new Date().toISOString(),
  };
  
  // 記錄到上下文管理器作為特殊的上下文類型
  await chatContextManager.setProjectContext(
    roomId,
    `thought_process_${record.id}`,
    JSON.stringify(record),
    24 // 24小時後過期
  );
  
  console.log(`🧠 記錄思考過程: ${record.reasoning.substring(0, 50)}...`);
  return record;
}

/**
 * POST - 處理聊天訊息
 */
export async function POST(request: NextRequest): Promise<NextResponse<EnhancedChatResponse>> {
  try {
    const body: EnhancedChatRequest = await request.json();
    const {
      message,
      action = 'send_message',
      roomId,
      apiToken,
      contextLength = 10,
    } = body;

    // 驗證 API Token
    if (!apiToken) {
      return NextResponse.json({
        success: false,
        error: '缺少必要參數: apiToken'
      }, { status: 400 });
    }

    if (!apiToken.startsWith('sk-')) {
      return NextResponse.json({
        success: false,
        error: 'API Token 格式不正確，應該以 sk- 開頭'
      }, { status: 401 });
    }

    // 對於發送訊息操作，message 是必需的
    if (action === 'send_message' && !message) {
      return NextResponse.json({
        success: false,
        error: '發送訊息時 message 參數是必需的'
      }, { status: 400 });
    }

    // 提取專案上下文
    const projectContext = extractProjectContextFromRequest(request, body);
    console.log(`📍 提取的專案上下文:`, projectContext);

    // 生成或使用現有的聊天室 ID
    const currentRoomId = roomId || generateId('room');

    console.log(`💬 處理請求 - 操作: ${action}, 房間: ${currentRoomId}, 上下文:`, projectContext);

    // 處理清理請求
    if (message === '__CLEANUP__') {
      await chatContextManager.cleanup();
      return NextResponse.json({
        success: true,
        data: {
          message: '清理完成',
          messageId: generateId('cleanup'),
          roomId: currentRoomId,
          contextUsed: '',
          projectContext
        }
      });
    }

    // 在發送訊息或創建房間之前，確保房間存在
    // 使用從上下文提取的專案資訊
    const room = await chatContextManager.getOrCreateChatRoom(
      currentRoomId,
      projectContext.projectId || projectContext.projectName || 'unknown',
      projectContext.projectName || projectContext.projectId || 'unknown',
      projectContext.containerId
    );
    console.log(`🏠 房間已確保存在: ${room.id}`);

    if (action === 'create_room') {
      console.log(`🏠 創建聊天室完成: ${room.id}`);

      // 獲取歡迎訊息
      const messages = await chatContextManager.getChatHistory(room.id, 1);

      return NextResponse.json({
        success: true,
        data: {
          message: messages.length > 0 ? messages[0].content : '歡迎使用！',
          messageId: messages.length > 0 ? messages[0].id : '',
          roomId: room.id,
          contextUsed: '', // No context used for creation
          projectContext
        },
      });
    }

    // 確保 message 不為 undefined
    if (!message) {
      return NextResponse.json({
        success: false,
        error: '訊息內容不能為空'
      }, { status: 400 });
    }

    // 1. 儲存用戶訊息
    const userMessage = await chatContextManager.addUserMessage(room.id, message!);
    console.log(`📝 用戶訊息已儲存: ${userMessage.id}`);

    // 2. 獲取對話歷史
    const history = await chatContextManager.getChatHistory(room.id, contextLength);
    // 將最後一條訊息(也就是剛加入的用戶訊息)排除，因為它會作為 input 傳入
    const chatHistoryMessages = history
      .slice(0, -1) 
      .map(msg => 
        msg.role === 'user' 
        ? new HumanMessage(msg.content) 
        : new AIMessage(msg.content)
      );
    console.log(`🧠 已獲取 ${chatHistoryMessages.length} 則對話歷史`);

    // 3. 獲取 Langchain 引擎
    const chatEngine = await getOrCreateChatEngine(projectContext, apiToken);

    // 4. 調用 Langchain 引擎
    console.log('🤖 開始處理 AI 回應...');
    const startTime = Date.now();
    const result = await chatEngine.invoke({
      input: message!,
      chat_history: chatHistoryMessages,
    });
    const duration = Date.now() - startTime;
    console.log(`✅ AI 回應完成，執行時間: ${duration}ms`);
    
    // 5. 處理和記錄回應
    // AgentExecutor 的輸出可能在 'output' 或 'intermediateSteps' 中
    let aiResponse = (result.output || result.toString()) as string;
    
    // 確保 AI 回應不為 null 或空字串
    if (!aiResponse || aiResponse.trim() === '' || aiResponse === 'null' || aiResponse === 'undefined') {
      aiResponse = '抱歉，我遇到了一些技術問題，無法產生適當的回應。請稍後再試或重新描述您的問題。';
      console.warn('⚠️ AI 回應為空或無效，使用預設回應', { 
        originalOutput: result.output,
        resultString: result.toString(),
        fullResult: result 
      });
    }
    
    const toolCalls = (result.intermediateSteps || []).map((step: { action: { tool: string; toolInput: Record<string, unknown> }; observation: unknown }) => ({
      tool: step.action.tool,
      input: step.action.toolInput,
      output: step.observation,
      success: true, // 假設成功，需要更精細的錯誤處理
      duration: 0, // 暫時無法獲取
    }));

    // 6. 儲存 AI 回應
    const aiMessage = await chatContextManager.addAssistantMessage(room.id, {
      message: aiResponse,
      messageId: generateId('ai-msg'),
      toolCallsExecuted: toolCalls.length
    });
    console.log(`🤖 AI 回應已儲存: ${aiMessage.id}`);

    // 7. 記錄工具調用
    const toolCallRecords = await recordToolCalls(room.id, aiMessage.id, toolCalls);

    // 8. 記錄思考過程（從 result 中提取）
    const thoughtProcess = await recordThoughtProcess(
      room.id,
      aiMessage.id,
      result.thoughtProcess
    );

    // 9. 計算統計資訊
    const toolCallsExecuted = toolCallRecords.length;
    const successfulCalls = toolCallRecords.filter(call => call.success).length;
    const failedCalls = toolCallsExecuted - successfulCalls;
    const averageExecutionTime = toolCallRecords.length > 0 
      ? toolCallRecords.reduce((sum, call) => sum + call.duration, 0) / toolCallRecords.length 
      : 0;

    // 統計工具使用
    const toolUsage: Record<string, number> = {};
    toolCallRecords.forEach(call => {
      toolUsage[call.toolName] = (toolUsage[call.toolName] || 0) + 1;
    });

    // 構建上下文資訊字串
    const contextUsed = [
      `對話歷史: ${chatHistoryMessages.length} 則`,
      `專案上下文: ${JSON.stringify(projectContext)}`,
      toolCallsExecuted > 0 ? `執行工具: ${toolCallsExecuted} 次` : '',
    ].filter(Boolean).join(', ');

    console.log(`📊 請求處理完成 - 工具調用: ${toolCallsExecuted}, 成功: ${successfulCalls}, 失敗: ${failedCalls}`);

    return NextResponse.json({
      success: true,
      data: {
        message: aiResponse,
        messageId: aiMessage.id,
        roomId: room.id,
        toolCallsExecuted,
        contextUsed,
        projectContext,
        toolCalls: toolCallRecords,
        thoughtProcess,
        stats: {
          totalCalls: toolCallsExecuted,
          successfulCalls,
          failedCalls,
          averageExecutionTime,
          toolUsage,
        }
      }
    });

  } catch (error) {
    console.error('❌ 處理聊天請求時發生錯誤:', error);

    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    const isRateLimitError = errorMessage.includes('rate limit') || errorMessage.includes('quota');
    const statusCode = isRateLimitError ? 429 : 500;

    return NextResponse.json({
      success: false,
      error: `處理請求失敗: ${errorMessage}`
    }, { status: statusCode });
  }
}

/**
 * GET - 獲取聊天室資訊
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const projectId = searchParams.get('projectId');
    const includeAnalytics = searchParams.get('analytics') === 'true';
    const includeToolCalls = searchParams.get('toolCalls') === 'true';
    const includeThoughts = searchParams.get('thoughts') === 'true';

    if (roomId) {
      // 獲取特定聊天室
      const chatWindow = await chatContextManager.getChatWindow(roomId);
      if (!chatWindow) {
        return NextResponse.json({
          success: false,
          error: '找不到指定的聊天室'
        }, { status: 404 });
      }

      const responseData: Record<string, unknown> = {
        room: chatWindow,
        messageCount: chatWindow.messages.length,
        totalTokens: chatWindow.totalTokens,
        totalCost: chatWindow.totalCost,
      };

      // 如果需要包含工具調用記錄
      if (includeToolCalls) {
        const toolCallRecords = await chatContextManager.getToolCallRecords(roomId);
        responseData.toolCalls = toolCallRecords;
        console.log(`🔧 獲取工具調用記錄: ${toolCallRecords.length} 條`);
      }

      // 如果需要包含思考過程記錄
      if (includeThoughts) {
        const thoughtRecords = await chatContextManager.getThoughtProcessRecords(roomId);
        responseData.thoughtProcesses = thoughtRecords;
        console.log(`🧠 獲取思考過程記錄: ${thoughtRecords.length} 條`);
      }

      // 如果需要包含完整分析報告
      if (includeAnalytics) {
        const analytics = await chatContextManager.getChatRoomAnalytics(roomId);
        responseData.analytics = analytics;
        console.log(`📊 獲取聊天室分析報告: ${analytics.toolCallCount} 個工具調用, ${analytics.thoughtProcessCount} 個思考過程`);
      }

      return NextResponse.json({
        success: true,
        data: responseData
      });
    }

    if (projectId) {
      // 獲取專案的所有聊天室
      const chatWindows = await chatContextManager.getChatWindows(projectId);
      const stats = await chatContextManager.getChatStats(projectId);

      const responseData: Record<string, unknown> = {
        rooms: chatWindows,
        stats,
      };

      // 如果需要包含每個聊天室的分析報告
      if (includeAnalytics) {
        const roomAnalytics = await Promise.all(
          chatWindows.map(async (room) => ({
            roomId: room.id,
            analytics: await chatContextManager.getChatRoomAnalytics(room.id)
          }))
        );
        responseData.roomAnalytics = roomAnalytics;
        console.log(`📊 獲取專案分析報告: ${roomAnalytics.length} 個聊天室`);
      }

      return NextResponse.json({
        success: true,
        data: responseData
      });
    }

    return NextResponse.json({
      success: false,
      error: '請提供 roomId 或 projectId 參數'
    }, { status: 400 });

  } catch (error) {
    console.error('💥 獲取聊天資訊錯誤:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    }, { status: 500 });
  }
}

/**
 * DELETE - 刪除聊天室
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json({
        success: false,
        error: '請提供 roomId 參數'
      }, { status: 400 });
    }

    const deleted = await chatContextManager.deleteChatRoom(roomId);
    
    if (!deleted) {
      return NextResponse.json({
        success: false,
        error: '找不到指定的聊天室或刪除失敗'
      }, { status: 404 });
    }

    console.log(`🗑️ 聊天室已刪除: ${roomId}`);

    return NextResponse.json({
      success: true,
      data: { message: '聊天室已成功刪除' }
    });

  } catch (error) {
    console.error('💥 刪除聊天室錯誤:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    }, { status: 500 });
  }
}

/**
 * PUT - 更新聊天室
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { roomId, title, isActive } = body;

    if (!roomId) {
      return NextResponse.json({
        success: false,
        error: '請提供 roomId 參數'
      }, { status: 400 });
    }

    let updated = false;

    if (title !== undefined) {
      updated = await chatContextManager.updateChatRoomTitle(roomId, title) || updated;
    }

    if (isActive === false) {
      updated = await chatContextManager.deactivateChatRoom(roomId) || updated;
    }

    if (!updated) {
      return NextResponse.json({
        success: false,
        error: '找不到指定的聊天室或更新失敗'
      }, { status: 404 });
    }

    console.log(`📝 聊天室已更新: ${roomId}`);

    return NextResponse.json({
      success: true,
      data: { message: '聊天室已成功更新' }
    });

  } catch (error) {
    console.error('💥 更新聊天室錯誤:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    }, { status: 500 });
  }
} 