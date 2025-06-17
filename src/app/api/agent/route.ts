import { NextRequest, NextResponse } from 'next/server';
import { AgentFactory } from '../../../lib/ai';
import { logger } from '../../../lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, config = {} } = body;

    // 驗證輸入
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: '請提供有效的訊息內容' },
        { status: 400 }
      );
    }

    logger.info(`[API:Agent] 收到請求: ${message.substring(0, 100)}...`);

    // 建立 Agent 並執行
    const factory = AgentFactory.getInstance();
    const result = await factory.quickRun(message, {
      maxToolCalls: config.maxToolCalls || 5,
      maxRetries: config.maxRetries || 2,
      timeoutMs: config.timeoutMs || 30000,
      enableLogging: config.enableLogging ?? true,
    });

    logger.info(`[API:Agent] 執行成功，回應長度: ${result.length}`);

    return NextResponse.json({
      success: true,
      result: result,
      metadata: {
        messageLength: message.length,
        resultLength: result.length,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error(`[API:Agent] 執行失敗: ${error}`);
    
    return NextResponse.json(
      {
        success: false,
        error: `Agent 執行失敗: ${error}`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const factory = AgentFactory.getInstance();

    switch (action) {
      case 'status':
        // 獲取系統狀態
        const status = factory.getSystemStatus();
        return NextResponse.json({
          success: true,
          status: status,
          timestamp: new Date().toISOString(),
        });

      case 'test':
        // 執行系統測試
        const testResult = await factory.testSystem();
        return NextResponse.json({
          success: true,
          testResult: testResult,
          timestamp: new Date().toISOString(),
        });

      case 'reset':
        // 重置工廠
        factory.reset();
        return NextResponse.json({
          success: true,
          message: '系統已重置',
          timestamp: new Date().toISOString(),
        });

      default:
        return NextResponse.json({
          success: true,
          message: 'AI 工具控制框架 API',
          availableActions: ['status', 'test', 'reset'],
          usage: {
            POST: '發送訊息給 Agent 執行',
            'GET?action=status': '獲取系統狀態',
            'GET?action=test': '執行系統測試',
            'GET?action=reset': '重置系統',
          },
          timestamp: new Date().toISOString(),
        });
    }

  } catch (error) {
    logger.error(`[API:Agent] GET 請求失敗: ${error}`);
    
    return NextResponse.json(
      {
        success: false,
        error: `API 請求失敗: ${error}`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
} 