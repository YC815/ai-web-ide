// 增強的聊天 API 路由
// 整合 SQLite 儲存和完整的上下文管理功能
import { NextRequest, NextResponse } from 'next/server';
import { chatContextManager, ChatResponse } from '@/lib/chat/chat-context-manager';
import { createLangchainChatEngine } from '@/lib/ai/langchain-chat-engine';
import { ProjectContext } from '@/lib/ai/context-manager';

// 請求介面
export interface EnhancedChatRequest {
  message?: string; // 對於創建房間操作，message 是可選的
  action?: 'create_room' | 'send_message'; // 操作類型
  roomId?: string; // 聊天室 ID，如果不提供則創建新的
  projectId: string;
  projectName: string;
  containerId?: string;
  apiToken: string;
  
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

// Langchain 引擎實例管理（按專案和 API Token 組合）
const chatEngines = new Map<string, ReturnType<typeof createLangchainChatEngine>>();

/**
 * 獲取或創建 Langchain 引擎
 */
function getOrCreateChatEngine(projectId: string, apiToken: string): ReturnType<typeof createLangchainChatEngine> {
  const engineKey = `${projectId}_${apiToken.substring(0, 10)}`;
  
  if (!chatEngines.has(engineKey)) {
    console.log(`🚀 創建新的 Langchain 引擎: ${engineKey}`);
    const engine = createLangchainChatEngine(apiToken, {
      model: 'gpt-4o',
      temperature: 0.1,
      maxTokens: 4000,
    });
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
 * POST - 處理聊天訊息
 */
export async function POST(request: NextRequest): Promise<NextResponse<EnhancedChatResponse>> {
  try {
    const body: EnhancedChatRequest = await request.json();
    const {
      message,
      action = 'send_message',
      roomId,
      projectId,
      projectName,
      containerId,
      apiToken,
      model = 'gpt-4o',
      temperature = 0.1,
      maxTokens = 4000,
      contextLength = 10,
    } = body;

    // 驗證必要參數
    if (!projectId || !projectName || !apiToken) {
      return NextResponse.json({
        success: false,
        error: '缺少必要參數: projectId, projectName, apiToken'
      }, { status: 400 });
    }

    // 對於發送訊息操作，message 是必需的
    if (action === 'send_message' && !message) {
      return NextResponse.json({
        success: false,
        error: '發送訊息時 message 參數是必需的'
      }, { status: 400 });
    }

    if (!apiToken.startsWith('sk-')) {
      return NextResponse.json({
        success: false,
        error: 'API Token 格式不正確，應該以 sk- 開頭'
      }, { status: 401 });
    }

    // 生成或使用現有的聊天室 ID
    const currentRoomId = roomId || generateId('room');

    console.log(`💬 處理請求 - 操作: ${action}, 房間: ${currentRoomId}, 專案: ${projectName}`);

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
        }
      });
    }

    // 確保聊天室存在
    const chatRoom = await chatContextManager.getOrCreateChatRoom(
      currentRoomId,
      projectId,
      projectName,
      containerId
    );

    // 如果只是創建房間，返回房間資訊
    if (action === 'create_room') {
      console.log(`🏠 創建聊天室完成: ${currentRoomId}`);
      return NextResponse.json({
        success: true,
        data: {
          message: `聊天室 ${currentRoomId} 已創建`,
          messageId: generateId('create-room'),
          roomId: currentRoomId,
          contextUsed: '新聊天室',
        }
      });
    }

    // 添加用戶訊息到資料庫
    const userMessage = await chatContextManager.addUserMessage(currentRoomId, message);
    console.log(`📝 用戶訊息已儲存: ${userMessage.id}`);

    // 構建上下文字串
    const contextString = await chatContextManager.buildContextString(currentRoomId, contextLength);
    console.log(`🧠 構建上下文完成，長度: ${contextString.length} 字元`);

    // 獲取 Langchain 引擎
    const chatEngine = getOrCreateChatEngine(projectId, apiToken);

    // 構建專案上下文
    const projectContext: ProjectContext = {
      projectId,
      projectName,
      containerStatus: 'running',
      containerId: containerId,
    };

    // 構建完整的訊息（包含上下文）
    const fullMessage = contextString 
      ? `${contextString}\n\n=== 當前用戶訊息 ===\n${message}`
      : message;

    console.log(`🤖 開始處理 AI 回應...`);
    const startTime = Date.now();

    // 使用 Langchain 引擎處理訊息
    const aiResponse = await chatEngine.processMessage(
      currentRoomId,
      fullMessage,
      projectContext
    );

    const executionTime = Date.now() - startTime;
    console.log(`✅ AI 回應完成，執行時間: ${executionTime}ms`);

    // 準備回應資料
    const responseData: ChatResponse = {
      message: aiResponse.message,
      messageId: generateId('msg'),
      tokens: aiResponse.toolCalls?.length || 0,
      cost: 0.001, // 預設成本，實際應該根據模型計算
      toolCallsExecuted: aiResponse.toolCalls?.length || 0,
      stats: {
        totalCalls: aiResponse.toolCalls?.length || 0,
        successfulCalls: aiResponse.toolCalls?.filter(call => call.success).length || 0,
        failedCalls: aiResponse.toolCalls?.filter(call => !call.success).length || 0,
        averageExecutionTime: executionTime,
        toolUsage: aiResponse.toolCalls?.reduce((acc, call) => {
          acc[call.tool] = (acc[call.tool] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {},
      },
    };

    // 添加 AI 回應訊息到資料庫
    const assistantMessage = await chatContextManager.addAssistantMessage(currentRoomId, responseData);
    console.log(`🤖 AI 回應已儲存: ${assistantMessage.id}`);

    // 記錄工具使用情況
    if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
      await chatContextManager.recordToolUsage(
        currentRoomId,
        'langchain_tools',
        { message: fullMessage },
        { response: aiResponse.message, toolCalls: aiResponse.toolCalls.length },
        true
      );
    }

    // 設置專案資訊到上下文（如果是新聊天室）
    if (!roomId) {
      await chatContextManager.setProjectContext(
        currentRoomId,
        'project_name',
        projectName,
        24 // 24小時後過期
      );
      
      if (containerId) {
        await chatContextManager.setProjectContext(
          currentRoomId,
          'container_id',
          containerId,
          24
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: aiResponse.message,
        messageId: assistantMessage.id,
        roomId: currentRoomId,
        tokens: responseData.tokens,
        cost: responseData.cost,
        toolCallsExecuted: responseData.toolCallsExecuted,
        contextUsed: contextString.substring(0, 500) + (contextString.length > 500 ? '...' : ''),
        stats: responseData.stats,
      }
    });

  } catch (error) {
    console.error('💥 增強聊天 API 錯誤:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    }, { status: 500 });
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

    if (roomId) {
      // 獲取特定聊天室
      const chatWindow = await chatContextManager.getChatWindow(roomId);
      if (!chatWindow) {
        return NextResponse.json({
          success: false,
          error: '找不到指定的聊天室'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: {
          room: chatWindow,
          messageCount: chatWindow.messages.length,
          totalTokens: chatWindow.totalTokens,
          totalCost: chatWindow.totalCost,
        }
      });
    }

    if (projectId) {
      // 獲取專案的所有聊天室
      const chatWindows = await chatContextManager.getChatWindows(projectId);
      const stats = await chatContextManager.getChatStats(projectId);

      return NextResponse.json({
        success: true,
        data: {
          rooms: chatWindows,
          stats,
        }
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