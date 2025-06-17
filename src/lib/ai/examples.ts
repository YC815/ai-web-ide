// OpenAI 整合使用範例
// 展示如何使用完整的 Node.js + GPT-4 function calling 流程

import { createOpenAIIntegration, OpenAIIntegrationConfig } from './openai';

// 🚀 基本使用範例
export async function basicOpenAIExample() {
  console.log('🚀 開始 OpenAI 整合基本範例');

  // 1. 創建配置
  const config: OpenAIIntegrationConfig = {
    openaiApiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    model: 'gpt-4',
    aiEditorConfig: {
      projectPath: '/path/to/your/project',
      projectContext: {
        projectId: 'demo-project',
        projectName: 'Demo Next.js App',
        containerStatus: 'running'
      },
      enableAdvancedTools: true,
      enableUserConfirmation: true,
      enableActionLogging: true
    },
    enableToolCallLogging: true,
    maxToolCalls: 10
  };

  // 2. 創建 OpenAI 整合實例
  const openaiIntegration = createOpenAIIntegration(config);

  // 3. 創建會話
  const sessionId = openaiIntegration.createSession();
  console.log(`📝 創建會話: ${sessionId}`);

  try {
    // 4. 發送訊息並自動處理工具調用
    const result = await openaiIntegration.sendMessage(
      sessionId,
      '請幫我分析這個專案的結構，然後讀取 package.json 檔案'
    );

    console.log('🤖 AI 回應:', result.response);
    console.log(`🔧 執行了 ${result.toolCallsExecuted} 個工具`);

    // 5. 獲取工具調用統計
    const stats = openaiIntegration.getToolCallStats(sessionId);
    console.log('📊 工具調用統計:', stats);

  } catch (error) {
    console.error('❌ 錯誤:', error);
  }
}

// 🔧 代碼修改流程範例
export async function codeModificationExample() {
  console.log('🔧 開始代碼修改流程範例');

  const config: OpenAIIntegrationConfig = {
    openaiApiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    model: 'gpt-4',
    aiEditorConfig: {
      projectPath: '/path/to/your/project',
      projectContext: {
        projectId: 'demo-project',
        projectName: 'Demo Next.js App',
        containerStatus: 'running'
      },
      enableUserConfirmation: true,
      enableActionLogging: true
    },
    enableToolCallLogging: true
  };

  const openaiIntegration = createOpenAIIntegration(config);
  const sessionId = openaiIntegration.createSession();

  try {
    // 步驟 1: 讀取現有組件
    console.log('📖 步驟 1: 分析現有組件');
    const step1 = await openaiIntegration.sendMessage(
      sessionId,
      '請先讀取 src/components/Button.tsx 檔案，然後分析它的結構'
    );
    console.log('AI:', step1.response);

    // 步驟 2: 提議修改
    console.log('✏️ 步驟 2: 提議代碼修改');
    const step2 = await openaiIntegration.sendMessage(
      sessionId,
      '請在這個 Button 組件中添加 loading 狀態支持，包含 loading prop 和 spinner 圖標。請先用 propose_diff 生成修改建議。'
    );
    console.log('AI:', step2.response);

    // 步驟 3: 執行測試
    console.log('🧪 步驟 3: 執行測試');
    const step3 = await openaiIntegration.sendMessage(
      sessionId,
      '請執行相關的測試檔案來確保修改沒有破壞現有功能'
    );
    console.log('AI:', step3.response);

    // 獲取最終統計
    const finalStats = openaiIntegration.getToolCallStats(sessionId);
    console.log('📊 最終統計:', finalStats);

  } catch (error) {
    console.error('❌ 錯誤:', error);
  }
}

// 🎨 工具調用可視化範例
export async function toolCallVisualizationExample() {
  console.log('🎨 開始工具調用可視化範例');

  const config: OpenAIIntegrationConfig = {
    openaiApiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    model: 'gpt-4',
    aiEditorConfig: {
      projectPath: '/path/to/your/project',
      projectContext: {
        projectId: 'demo-project',
        projectName: 'Demo Next.js App',
        containerStatus: 'running'
      },
      enableUserConfirmation: true,
      enableActionLogging: true
    },
    enableToolCallLogging: true
  };

  const openaiIntegration = createOpenAIIntegration(config);
  const sessionId = openaiIntegration.createSession();

  // 自定義工具調用監聽器
  const originalSendMessage = openaiIntegration.sendMessage.bind(openaiIntegration);
  
  // 包裝 sendMessage 以添加可視化
  const sendMessageWithVisualization = async (sessionId: string, message: string) => {
    console.log('\n🎯 用戶請求:', message);
    console.log('⏳ AI 思考中...\n');

    const result = await originalSendMessage(sessionId, message);
    
    // 顯示工具調用過程
    const session = openaiIntegration.getSession(sessionId);
    if (session) {
      const recentLogs = session.toolCallLogs.slice(-result.toolCallsExecuted);
      
      console.log('🔧 工具調用過程:');
      recentLogs.forEach((log, index) => {
        const status = log.success ? '✅' : '❌';
        console.log(`  ${index + 1}. ${status} ${log.toolName} (${log.executionTime}ms)`);
        
        if (log.parameters && Object.keys(log.parameters).length > 0) {
          console.log(`     參數:`, JSON.stringify(log.parameters, null, 2));
        }
        
        if (log.error) {
          console.log(`     錯誤: ${log.error}`);
        }
      });
    }
    
    console.log('\n🤖 AI 最終回應:', result.response);
    console.log(`📊 總共執行了 ${result.toolCallsExecuted} 個工具\n`);
    
    return result;
  };

  try {
    // 執行一系列操作並可視化
    await sendMessageWithVisualization(
      sessionId,
      '請幫我搜尋專案中所有包含 "useState" 的檔案，然後讀取其中一個檔案的內容'
    );

    await sendMessageWithVisualization(
      sessionId,
      '請檢查 Git 狀態，看看有哪些檔案被修改了'
    );

    await sendMessageWithVisualization(
      sessionId,
      '請執行 npm test 來運行測試'
    );

  } catch (error) {
    console.error('❌ 錯誤:', error);
  }
}

// 📊 會話管理範例
export async function sessionManagementExample() {
  console.log('📊 開始會話管理範例');

  const config: OpenAIIntegrationConfig = {
    openaiApiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    model: 'gpt-4',
    aiEditorConfig: {
      projectPath: '/path/to/your/project',
      projectContext: {
        projectId: 'demo-project',
        projectName: 'Demo Next.js App',
        containerStatus: 'running'
      }
    }
  };

  const openaiIntegration = createOpenAIIntegration(config);

  // 創建多個會話
  const session1 = openaiIntegration.createSession('你是一個前端開發專家');
  const session2 = openaiIntegration.createSession('你是一個後端開發專家');
  const session3 = openaiIntegration.createSession('你是一個測試專家');

  console.log('創建了 3 個專門化會話');

  try {
    // 在不同會話中進行不同類型的對話
    await openaiIntegration.sendMessage(session1, '請分析前端組件的結構');
    await openaiIntegration.sendMessage(session2, '請檢查 API 路由的實作');
    await openaiIntegration.sendMessage(session3, '請執行所有測試並分析結果');

    // 獲取所有會話
    const allSessions = openaiIntegration.getAllSessions();
    console.log(`\n📋 總共有 ${allSessions.length} 個會話:`);
    
    allSessions.forEach(session => {
      console.log(`  - ${session.id}: ${session.messages.length} 條訊息, ${session.toolCallLogs.length} 次工具調用`);
    });

    // 獲取全局統計
    const globalStats = openaiIntegration.getToolCallStats();
    console.log('\n📊 全局工具調用統計:', globalStats);

    // 導出會話
    const exportedSession = openaiIntegration.exportSession(session1);
    console.log('\n💾 導出會話 1 的數據長度:', exportedSession?.length);

    // 導入會話
    if (exportedSession) {
      const importedSessionId = openaiIntegration.importSession(exportedSession);
      console.log('📥 導入會話成功:', importedSessionId);
    }

  } catch (error) {
    console.error('❌ 錯誤:', error);
  }
}

// 🔒 安全性和用戶確認範例
export async function securityAndConfirmationExample() {
  console.log('🔒 開始安全性和用戶確認範例');

  const config: OpenAIIntegrationConfig = {
    openaiApiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    model: 'gpt-4',
    aiEditorConfig: {
      projectPath: '/path/to/your/project',
      projectContext: {
        projectId: 'demo-project',
        projectName: 'Demo Next.js App',
        containerStatus: 'running'
      },
      enableUserConfirmation: true,
      enableActionLogging: true
    },
    enableToolCallLogging: true
  };

  const openaiIntegration = createOpenAIIntegration(config);
  const sessionId = openaiIntegration.createSession();

  try {
    // 請求執行需要確認的操作
    console.log('🚨 請求執行危險操作...');
    const result = await openaiIntegration.sendMessage(
      sessionId,
      '請幫我重構 src/components/Button.tsx 檔案，添加新的 props 和樣式'
    );

    console.log('AI 回應:', result.response);

    // 檢查是否有待處理的操作
    const pendingActions = openaiIntegration.getPendingActions();
    console.log(`\n⏳ 有 ${pendingActions.length} 個待處理的操作:`);
    
    pendingActions.forEach(action => {
      console.log(`  - ${action.toolName}: ${action.status}`);
      if (action.confirmationRequest) {
        console.log(`    確認訊息: ${action.confirmationRequest.message}`);
      }
    });

    // 模擬用戶確認
    if (pendingActions.length > 0) {
      const firstAction = pendingActions[0];
      console.log(`\n✅ 模擬用戶確認操作: ${firstAction.id}`);
      
      await openaiIntegration.handleUserConfirmation(firstAction.id, true);
      console.log('用戶確認完成');
    }

  } catch (error) {
    console.error('❌ 錯誤:', error);
  }
}

// 🚀 完整工作流程範例
export async function completeWorkflowExample() {
  console.log('🚀 開始完整工作流程範例');

  const config: OpenAIIntegrationConfig = {
    openaiApiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    model: 'gpt-4',
    aiEditorConfig: {
      projectPath: '/path/to/your/project',
      projectContext: {
        projectId: 'demo-project',
        projectName: 'Demo Next.js App',
        containerStatus: 'running'
      },
      enableAdvancedTools: true,
      enableUserConfirmation: true,
      enableActionLogging: true
    },
    enableToolCallLogging: true,
    maxToolCalls: 20
  };

  const openaiIntegration = createOpenAIIntegration(config);
  const sessionId = openaiIntegration.createSession();

  const workflow = [
    '請先分析整個專案的結構，了解主要的組件和檔案',
    '搜尋專案中所有的 React 組件，特別是 Button 相關的組件',
    '讀取 Button 組件的內容，分析它的 props 和功能',
    '提議在 Button 組件中添加 loading 狀態支持，包含 loading prop 和 spinner 動畫',
    '檢查是否有相關的測試檔案，如果有請執行測試',
    '檢查 Git 狀態，看看我們的修改對專案的影響',
    '總結這次修改的內容和建議'
  ];

  try {
    for (let i = 0; i < workflow.length; i++) {
      const step = workflow[i];
      console.log(`\n📋 步驟 ${i + 1}/${workflow.length}: ${step}`);
      console.log('⏳ 執行中...');

      const result = await openaiIntegration.sendMessage(sessionId, step);
      
      console.log(`✅ 完成 (執行了 ${result.toolCallsExecuted} 個工具)`);
      console.log('AI 回應:', result.response.substring(0, 200) + '...');
      
      // 處理待處理的操作
      const pendingActions = openaiIntegration.getPendingActions();
      if (pendingActions.length > 0) {
        console.log(`⏳ 處理 ${pendingActions.length} 個待處理操作...`);
        for (const action of pendingActions) {
          await openaiIntegration.handleUserConfirmation(action.id, true);
        }
      }
      
      // 短暫延遲
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 最終統計
    const finalStats = openaiIntegration.getToolCallStats(sessionId);
    console.log('\n📊 工作流程完成統計:');
    console.log(`  總工具調用: ${finalStats.totalCalls}`);
    console.log(`  成功: ${finalStats.successfulCalls}`);
    console.log(`  失敗: ${finalStats.failedCalls}`);
    console.log(`  平均執行時間: ${finalStats.averageExecutionTime.toFixed(2)}ms`);
    console.log('  工具使用分布:', finalStats.toolUsage);

  } catch (error) {
    console.error('❌ 工作流程執行失敗:', error);
  }
}

// 導出所有範例
export const openaiExamples = {
  basic: basicOpenAIExample,
  codeModification: codeModificationExample,
  toolCallVisualization: toolCallVisualizationExample,
  sessionManagement: sessionManagementExample,
  securityAndConfirmation: securityAndConfirmationExample,
  completeWorkflow: completeWorkflowExample
};

// 執行所有範例的函數
export async function runAllExamples() {
  console.log('🎯 開始執行所有 OpenAI 整合範例\n');
  
  const examples = Object.entries(openaiExamples);
  
  for (let i = 0; i < examples.length; i++) {
    const [name, exampleFn] = examples[i];
    
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📝 範例 ${i + 1}/${examples.length}: ${name}`);
    console.log('='.repeat(50));
    
    try {
      await exampleFn();
      console.log(`✅ 範例 ${name} 執行完成`);
    } catch (error) {
      console.error(`❌ 範例 ${name} 執行失敗:`, error);
    }
    
    // 範例間延遲
    if (i < examples.length - 1) {
      console.log('\n⏳ 等待 3 秒後執行下一個範例...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log('\n🎉 所有範例執行完成！');
} 