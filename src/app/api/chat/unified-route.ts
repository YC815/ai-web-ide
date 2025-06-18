/**
 * 統一聊天 API 路由
 * 使用新的統一 Function Call 系統和 AI Agent 整合器
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  UnifiedAIAgentIntegrator, 
  createUnifiedAIAgent,
  type UnifiedAgentConfig,
  type AgentResponse 
} from '../../lib/ai/unified-ai-agent-integration';
import { logger } from '../../lib/logger';

// 全域 Agent 實例管理
const globalAgents = new Map<string, UnifiedAIAgentIntegrator>();

interface UnifiedChatRequest {
  message: string;
  projectId: string;
  projectName?: string;
  containerId?: string;
  conversationId?: string;
  apiToken: string;
  
  // 可選配置
  model?: string;
  temperature?: number;
  maxTokens?: number;
  enableToolSelection?: boolean;
  enableLogging?: boolean;
}

interface UnifiedChatResponse {
  success: boolean;
  data?: {
    message: string;
    conversationId: string;
    toolCalls?: Array<{
      toolId: string;
      toolName: string;
      success: boolean;
      duration: number;
    }>;
    sessionInfo?: {
      messageCount: number;
      tokenCount: number;
      sessionAge: string;
    };
    suggestions?: string[];
  };
  error?: string;
}

/**
 * 處理統一聊天請求
 */
export async function POST(request: NextRequest): Promise<NextResponse<UnifiedChatResponse>> {
  try {
    const body: UnifiedChatRequest = await request.json();
    
    // 驗證必要參數
    if (!body.message || !body.projectId || !body.apiToken) {
      return NextResponse.json({
        success: false,
        error: '缺少必要參數: message, projectId, apiToken'
      }, { status: 400 });
    }

    logger.info(`[UnifiedChatAPI] 📨 收到聊天請求: ${body.projectId}`);

    // 生成會話 ID
    const conversationId = body.conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 創建或獲取 Agent 實例
    const agentKey = `${body.projectId}_${body.apiToken.substring(0, 10)}`;
    let agent = globalAgents.get(agentKey);
    
    if (!agent) {
      logger.info(`[UnifiedChatAPI] 🚀 創建新的統一 AI Agent: ${agentKey}`);
      agent = createUnifiedAIAgent({
        model: body.model || 'gpt-4o',
        temperature: body.temperature || 0.1,
        maxTokens: body.maxTokens || 4000,
        enableToolSelection: body.enableToolSelection !== false,
        enableLogging: body.enableLogging !== false
      });
      globalAgents.set(agentKey, agent);
    }

    // 構建 Agent 配置
    const agentConfig: UnifiedAgentConfig = {
      projectId: body.projectId,
      projectName: body.projectName || body.projectId,
      containerId: body.containerId,
      apiKey: body.apiToken,
      model: body.model || 'gpt-4o',
      temperature: body.temperature || 0.1,
      maxTokens: body.maxTokens || 4000,
      maxIterations: 10,
      maxRetries: 3,
      contextWindow: 20,
      enableToolSelection: body.enableToolSelection !== false,
      enableLogging: body.enableLogging !== false
    };

    // 處理訊息
    const agentResponse: AgentResponse = await agent.processMessage(
      conversationId,
      body.message,
      agentConfig
    );

    // 構建回應
    const response: UnifiedChatResponse = {
      success: true,
      data: {
        message: agentResponse.message,
        conversationId,
        toolCalls: agentResponse.toolCalls.map(call => ({
          toolId: call.toolId,
          toolName: call.toolName,
          success: call.success,
          duration: call.duration
        })),
        sessionInfo: agentResponse.sessionInfo,
        suggestions: agentResponse.toolCalls.length > 0 
          ? [`使用了 ${agentResponse.toolCalls.length} 個工具來完成任務`]
          : undefined
      }
    };

    logger.info(`[UnifiedChatAPI] ✅ 處理完成: ${conversationId}, 工具調用: ${agentResponse.toolCalls.length}`);
    
    return NextResponse.json(response);

  } catch (error) {
    logger.error(`[UnifiedChatAPI] ❌ 處理請求失敗:`, error);
    
    return NextResponse.json({
      success: false,
      error: `處理請求時發生錯誤: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}

/**
 * 獲取 Agent 統計資訊
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const stats = {
      totalAgents: globalAgents.size,
      agentStats: Array.from(globalAgents.entries()).map(([key, agent]) => ({
        agentKey: key,
        sessionStats: agent.getSessionStats()
      }))
    };

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error(`[UnifiedChatAPI] ❌ 獲取統計失敗:`, error);
    
    return NextResponse.json({
      success: false,
      error: `獲取統計時發生錯誤: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}

/**
 * 清理過期會話
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const maxAge = parseInt(url.searchParams.get('maxAge') || '86400000'); // 24小時

    let totalCleaned = 0;
    
    for (const [key, agent] of globalAgents.entries()) {
      const statsBefore = agent.getSessionStats();
      // 注意：需要在 UnifiedAIAgentIntegrator 中添加 cleanupExpiredSessions 方法
      // agent.cleanupExpiredSessions(maxAge);
      const statsAfter = agent.getSessionStats();
      
      const cleaned = statsBefore.activeSessions - statsAfter.activeSessions;
      totalCleaned += cleaned;
      
      logger.info(`[UnifiedChatAPI] 🗑️ Agent ${key} 清理了 ${cleaned} 個過期會話`);
    }

    return NextResponse.json({
      success: true,
      data: {
        totalCleaned,
        remainingAgents: globalAgents.size
      }
    });

  } catch (error) {
    logger.error(`[UnifiedChatAPI] ❌ 清理會話失敗:`, error);
    
    return NextResponse.json({
      success: false,
      error: `清理會話時發生錯誤: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}

// 定期清理過期會話（每小時執行一次）
if (typeof window === 'undefined') {
  setInterval(() => {
    try {
      const maxAge = 24 * 60 * 60 * 1000; // 24小時
      let totalCleaned = 0;
      
      for (const [key, agent] of globalAgents.entries()) {
        const statsBefore = agent.getSessionStats();
        // agent.cleanupExpiredSessions(maxAge);
        const statsAfter = agent.getSessionStats();
        
        const cleaned = statsBefore.activeSessions - statsAfter.activeSessions;
        totalCleaned += cleaned;
      }
      
      if (totalCleaned > 0) {
        logger.info(`[UnifiedChatAPI] 🕐 定期清理完成，共清理 ${totalCleaned} 個過期會話`);
      }
    } catch (error) {
      logger.error(`[UnifiedChatAPI] ❌ 定期清理失敗:`, error);
    }
  }, 60 * 60 * 1000); // 每小時執行一次
}

export default {
  POST,
  GET,
  DELETE
}; 