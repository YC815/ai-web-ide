/**
 * 簡化的聊天 API 路由
 * 使用簡化的 LangChain 引擎，專注於穩定性
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSimpleLangchainEngine } from '../../../lib/ai/simple-langchain-engine';
import { logger } from '../../../lib/logger';

// 從環境變數或默認值獲取 Docker 配置
const DOCKER_CONTAINER_ID = process.env.DOCKER_CONTAINER_ID || 'ai-web-ide-new-web-1750235669810';
const PROJECT_NAME = process.env.PROJECT_NAME || 'new_web';
const WORKING_DIRECTORY = process.env.WORKING_DIRECTORY || '/app/workspace/new_web';

export async function POST(request: NextRequest) {
  try {
    logger.info('[SimpleRoute] 接收到聊天請求');

    const body = await request.json();
    const { message, projectName } = body;

    if (!message) {
      return NextResponse.json({
        success: false,
        error: '缺少訊息內容'
      }, { status: 400 });
    }

    // 使用傳入的專案名稱或默認值
    const currentProjectName = projectName || PROJECT_NAME;
    const currentWorkingDirectory = `/app/workspace/${currentProjectName}`;

    logger.info(`[SimpleRoute] 處理訊息: ${message.substring(0, 100)}...`);
    logger.info(`[SimpleRoute] 專案配置: ${currentProjectName}, 容器: ${DOCKER_CONTAINER_ID}`);

    // 創建簡化的 LangChain 引擎
    const engine = createSimpleLangchainEngine(
      DOCKER_CONTAINER_ID,
      currentProjectName,
      currentWorkingDirectory
    );

    // 處理聊天訊息
    const response = await engine.handleChat(message);

    logger.info(`[SimpleRoute] 處理完成，回應長度: ${response.length}`);

    return NextResponse.json({
      success: true,
      response: response,
      timestamp: new Date().toISOString(),
      projectName: currentProjectName,
      containerId: DOCKER_CONTAINER_ID
    });

  } catch (error) {
    logger.error(`[SimpleRoute] 處理聊天請求失敗: ${error}`);

    return NextResponse.json({
      success: false,
      error: `處理請求時發生錯誤: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// 健康檢查端點
export async function GET(request: NextRequest) {
  try {
    logger.info('[SimpleRoute] 健康檢查請求');

    return NextResponse.json({
      success: true,
      status: 'healthy',
      engineType: 'SimpleLangchainEngine',
      dockerContainer: DOCKER_CONTAINER_ID,
      projectName: PROJECT_NAME,
      workingDirectory: WORKING_DIRECTORY,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`[SimpleRoute] 健康檢查失敗: ${error}`);

    return NextResponse.json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 