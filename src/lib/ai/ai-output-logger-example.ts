/**
 * AI 輸出記錄器使用範例
 * 展示如何使用 AIOutputLogger 記錄AI的輸出和決策過程
 */

import { AIOutputLogger, aiOutputLogger } from './ai-output-logger';
import { AgentFactory } from './agent-factory';

/**
 * 基本使用範例
 */
export async function basicUsageExample() {
  console.log('=== AI 輸出記錄器基本使用範例 ===\n');

  // 記錄系統啟動
  await aiOutputLogger.logSystem(
    'Example',
    '開始AI輸出記錄器使用範例',
    { timestamp: new Date().toISOString() }
  );

  // 記錄AI決策過程
  await aiOutputLogger.logDecision(
    'Example',
    '決定使用 gpt-4o 模型來處理使用者請求',
    { 
      model: 'gpt-4o',
      reason: '使用者請求需要複雜的推理能力',
      alternatives: ['gpt-3.5-turbo', 'claude-3']
    }
  );

  // 記錄AI輸出
  await aiOutputLogger.logOutput(
    'Example',
    '生成回應：您好！我是AI助手，很高興為您服務。',
    {
      inputTokens: 150,
      outputTokens: 25,
      totalTokens: 175,
      responseTime: '1.2s'
    }
  );

  // 記錄錯誤
  await aiOutputLogger.logError(
    'Example',
    '模型API呼叫失敗',
    {
      errorCode: 'API_TIMEOUT',
      retryCount: 2,
      maxRetries: 3
    }
  );

  console.log('✅ 基本使用範例完成');
}

/**
 * 與 AgentFactory 整合使用範例
 */
export async function agentFactoryIntegrationExample() {
  console.log('\n=== AgentFactory 整合使用範例 ===\n');

  try {
    // 記錄開始
    await aiOutputLogger.logSystem(
      'AgentFactoryExample',
      '開始AgentFactory整合測試',
      { testType: 'integration' }
    );

    // 建立AgentFactory實例
    const agentFactory = AgentFactory.getInstance();

    // 執行測試案例
    const testMessage = "請幫我列出當前目錄的內容";
    
    // 記錄測試決策
    await aiOutputLogger.logDecision(
      'AgentFactoryExample',
      `選擇測試案例: ${testMessage}`,
      { 
        testCase: 'LIST_DIRECTORY',
        reason: '這是一個簡單的檔案系統操作測試'
      }
    );

    // 執行Agent
    const result = await agentFactory.quickRun(testMessage, {
      enableLogging: true,
      maxToolCalls: 3,
      timeoutMs: 30000
    });

    // 記錄結果
    await aiOutputLogger.logOutput(
      'AgentFactoryExample',
      `Agent執行結果: ${result}`,
      {
        success: true,
        testCase: 'LIST_DIRECTORY',
        resultLength: result.length
      }
    );

    console.log('✅ AgentFactory 整合範例完成');
    return result;

  } catch (error) {
    // 記錄錯誤
    await aiOutputLogger.logError(
      'AgentFactoryExample',
      `AgentFactory整合測試失敗: ${error}`,
      { 
        error: String(error),
        testType: 'integration'
      }
    );

    console.error('❌ AgentFactory 整合範例失敗:', error);
    throw error;
  }
}

/**
 * 記錄統計和管理範例
 */
export async function logManagementExample() {
  console.log('\n=== 記錄管理範例 ===\n');

  // 獲取記錄統計
  const stats = await aiOutputLogger.getLogStats();
  console.log('記錄統計:', stats);

  await aiOutputLogger.logSystem(
    'LogManagement',
    '記錄統計資訊',
    stats
  );

  // 獲取最近的記錄
  const recentLogs = await aiOutputLogger.getRecentLogs(10);
  console.log(`最近 ${recentLogs.length} 條記錄:`);
  recentLogs.forEach((log, index) => {
    console.log(`${index + 1}. ${log}`);
  });

  // 清理舊記錄（保留7天）
  await aiOutputLogger.cleanupOldLogs(7);
  
  await aiOutputLogger.logSystem(
    'LogManagement',
    '記錄管理操作完成',
    { 
      recentLogsCount: recentLogs.length,
      cleanupDays: 7
    }
  );

  console.log('✅ 記錄管理範例完成');
}

/**
 * 自訂配置範例
 */
export async function customConfigExample() {
  console.log('\n=== 自訂配置範例 ===\n');

  // 建立自訂配置的記錄器
  const customLogger = AIOutputLogger.getInstance({
    logDirectory: './logs/custom-ai-outputs',
    logFileName: 'custom-ai-output.log',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    enableRotation: true,
    enableConsoleOutput: true, // 啟用控制台輸出
  });

  await customLogger.initialize();

  // 使用自訂記錄器
  await customLogger.logSystem(
    'CustomConfig',
    '使用自訂配置的記錄器',
    {
      logDirectory: './logs/custom-ai-outputs',
      maxFileSize: '10MB',
      consoleOutput: true
    }
  );

  await customLogger.logDecision(
    'CustomConfig',
    '這是使用自訂配置記錄器的決策記錄',
    { customConfig: true }
  );

  console.log('✅ 自訂配置範例完成');
}

/**
 * 執行所有範例
 */
export async function runAllLoggerExamples() {
  console.log('🚀 開始執行AI輸出記錄器所有範例\n');

  try {
    await basicUsageExample();
    await logManagementExample();
    await customConfigExample();
    
    // 注意：AgentFactory範例需要Docker環境，可能會失敗
    try {
      await agentFactoryIntegrationExample();
    } catch (error) {
      console.log('⚠️ AgentFactory 範例跳過（需要Docker環境）:', String(error));
    }

    console.log('\n🎉 所有範例執行完成！');
    
    // 最終記錄
    await aiOutputLogger.logSystem(
      'Examples',
      '所有AI輸出記錄器範例執行完成',
      { 
        completedAt: new Date().toISOString(),
        success: true
      }
    );

  } catch (error) {
    console.error('\n❌ 範例執行失敗:', error);
    
    await aiOutputLogger.logError(
      'Examples',
      `範例執行失敗: ${error}`,
      { 
        error: String(error),
        failedAt: new Date().toISOString()
      }
    );
    
    throw error;
  }
}

// 如果直接執行此檔案，則運行所有範例
if (require.main === module) {
  runAllLoggerExamples().catch(console.error);
} 