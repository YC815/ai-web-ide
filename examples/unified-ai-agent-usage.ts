/**
 * 統一 AI Agent 使用示例
 * 展示如何在實際專案中整合和使用新的統一 Function Call 系統
 */

import { 
  createUnifiedAIAgent, 
  UnifiedAgentConfig,
  type AgentResponse 
} from '../src/lib/ai/unified-ai-agent-integration';
import { searchTools, toolsByCategory } from '../src/lib/functions';
import { selectToolsForRequest } from '../src/lib/functions/langchain-binder';

// 模擬環境變數
const MOCK_API_KEY = 'sk-mock-api-key-for-demo';

/**
 * 示例 1: 基本 AI Agent 使用
 */
async function basicAgentUsage() {
  console.log('🤖 示例 1: 基本 AI Agent 使用');
  console.log('=' .repeat(40));

  // 創建 AI Agent
  const agent = createUnifiedAIAgent({
    model: 'gpt-4o',
    temperature: 0.1,
    maxTokens: 4000,
    enableToolSelection: true,
    enableLogging: true
  });

  // 配置專案資訊
  const config: UnifiedAgentConfig = {
    projectId: 'demo-nextjs-app',
    projectName: 'Demo Next.js Application',
    containerId: 'ai-web-ide-demo-nextjs-app-123',
    apiKey: MOCK_API_KEY,
    maxIterations: 10,
    maxRetries: 3,
    contextWindow: 20,
    enableToolSelection: true,
    enableLogging: true
  };

  try {
    // 模擬用戶請求
    const userMessages = [
      '請幫我查看專案結構',
      '檢查 Docker 容器狀態',
      '分析程式碼品質',
      '查看系統資源使用情況'
    ];

    for (const message of userMessages) {
      console.log(`\n📨 用戶請求: ${message}`);
      
      // 在實際使用中，這裡會調用 OpenAI API
      // 為了示例，我們模擬回應
      const mockResponse: AgentResponse = {
        message: `我已經分析了您的請求："${message}"。基於統一工具系統，我會使用相關的工具來完成這個任務。`,
        toolCalls: [
          {
            toolId: 'tool_1',
            toolName: 'projectInfo',
            input: { projectId: config.projectId },
            output: '專案資訊已獲取',
            success: true,
            duration: 150,
            timestamp: new Date().toISOString()
          }
        ],
        sessionInfo: {
          sessionId: 'demo-session',
          messageCount: 1,
          tokenCount: 250,
          sessionAge: '30s'
        }
      };

      console.log(`🤖 AI 回應: ${mockResponse.message}`);
      console.log(`🔧 使用工具: ${mockResponse.toolCalls.map(t => t.toolName).join(', ')}`);
    }

  } catch (error) {
    console.error('❌ 基本使用示例失敗:', error);
  }
}

/**
 * 示例 2: 智能工具選擇
 */
async function intelligentToolSelection() {
  console.log('\n🧠 示例 2: 智能工具選擇');
  console.log('=' .repeat(40));

  const testRequests = [
    '請幫我檢查 Docker 容器的狀態',
    '我想分析專案的程式碼結構',
    '查看檔案系統中的配置檔案',
    '監控系統資源使用情況',
    '測試 API 端點是否正常'
  ];

  for (const request of testRequests) {
    console.log(`\n📝 請求: ${request}`);
    
    // 使用智能工具選擇
    const selectedTools = selectToolsForRequest(request);
    console.log(`🔧 選中工具: ${selectedTools.map(t => t.name).join(', ')}`);
    console.log(`📊 工具數量: ${selectedTools.length}`);
  }
}

/**
 * 示例 3: 工具分類和搜尋
 */
async function toolCategoriesAndSearch() {
  console.log('\n🔍 示例 3: 工具分類和搜尋');
  console.log('=' .repeat(40));

  // 顯示所有工具分類
  console.log('\n📂 可用工具分類:');
  Object.keys(toolsByCategory).forEach(category => {
    const tools = toolsByCategory[category] || [];
    console.log(`  ${category}: ${tools.length} 個工具`);
  });

  // 搜尋特定功能的工具
  const searchQueries = [
    'docker',
    'file read',
    'project info',
    'monitor system',
    'ai agent'
  ];

  console.log('\n🔎 工具搜尋結果:');
  searchQueries.forEach(query => {
    const results = searchTools(query);
    console.log(`  "${query}": ${results.length} 個匹配工具`);
    results.slice(0, 3).forEach(tool => {
      console.log(`    - ${tool.name}: ${tool.description.substring(0, 50)}...`);
    });
  });
}

/**
 * 示例 4: 會話管理和統計
 */
async function sessionManagementAndStats() {
  console.log('\n📊 示例 4: 會話管理和統計');
  console.log('=' .repeat(40));

  const agent = createUnifiedAIAgent();

  // 獲取初始統計
  const initialStats = agent.getSessionStats();
  console.log('📈 初始統計:');
  console.log(`  活躍會話: ${initialStats.activeSessions}`);
  console.log(`  總記憶體使用: ${initialStats.totalMemoryUsage} tokens`);

  // 模擬創建多個會話
  const config: UnifiedAgentConfig = {
    projectId: 'multi-session-demo',
    projectName: 'Multi Session Demo',
    apiKey: MOCK_API_KEY
  };

  console.log('\n🔄 模擬會話創建...');
  try {
    // 在實際使用中，這些會創建真實的會話
    console.log('  會話 1: 專案探索會話');
    console.log('  會話 2: Docker 管理會話');
    console.log('  會話 3: 程式碼分析會話');

    // 模擬統計更新
    const updatedStats = {
      activeSessions: 3,
      totalMemoryUsage: 1250
    };

    console.log('\n📈 更新後統計:');
    console.log(`  活躍會話: ${updatedStats.activeSessions}`);
    console.log(`  總記憶體使用: ${updatedStats.totalMemoryUsage} tokens`);

  } catch (error) {
    console.error('❌ 會話管理示例失敗:', error);
  }
}

/**
 * 示例 5: API 整合範例
 */
async function apiIntegrationExample() {
  console.log('\n🌐 示例 5: API 整合範例');
  console.log('=' .repeat(40));

  // 模擬 Next.js API 路由
  const mockApiHandler = async (request: {
    message: string;
    projectId: string;
    apiToken: string;
  }) => {
    console.log(`📨 API 請求: ${request.message}`);

    const agent = createUnifiedAIAgent();
    
    const config: UnifiedAgentConfig = {
      projectId: request.projectId,
      projectName: request.projectId,
      apiKey: request.apiToken,
      enableToolSelection: true
    };

    // 在實際使用中，這裡會處理真實的 AI 回應
    const mockResponse = {
      success: true,
      data: {
        message: `已處理您的請求: ${request.message}`,
        conversationId: `conv_${Date.now()}`,
        toolCalls: [
          {
            toolId: 'tool_1',
            toolName: 'projectInfo',
            success: true,
            duration: 120
          }
        ],
        sessionInfo: {
          messageCount: 1,
          tokenCount: 180,
          sessionAge: '5s'
        }
      }
    };

    console.log(`✅ API 回應: ${mockResponse.data.message}`);
    return mockResponse;
  };

  // 測試 API 調用
  const testRequests = [
    {
      message: '查看專案狀態',
      projectId: 'api-test-project',
      apiToken: MOCK_API_KEY
    },
    {
      message: '檢查容器健康狀態',
      projectId: 'docker-project',
      apiToken: MOCK_API_KEY
    }
  ];

  for (const request of testRequests) {
    await mockApiHandler(request);
    console.log('---');
  }
}

/**
 * 示例 6: 錯誤處理和重試機制
 */
async function errorHandlingExample() {
  console.log('\n⚠️ 示例 6: 錯誤處理和重試機制');
  console.log('=' .repeat(40));

  const agent = createUnifiedAIAgent({
    maxRetries: 3,
    enableLogging: true
  });

  const config: UnifiedAgentConfig = {
    projectId: 'error-test-project',
    projectName: 'Error Test Project',
    apiKey: 'invalid-api-key', // 模擬無效的 API Key
    maxRetries: 3
  };

  try {
    console.log('🔄 嘗試處理可能失敗的請求...');
    
    // 模擬錯誤回應
    const errorResponse: AgentResponse = {
      message: '❌ 處理請求時發生錯誤: API Key 無效',
      toolCalls: [],
      sessionInfo: {
        sessionId: 'error-session',
        messageCount: 0,
        tokenCount: 0,
        sessionAge: '0s'
      },
      error: 'Invalid API Key'
    };

    console.log(`🚨 錯誤回應: ${errorResponse.message}`);
    console.log(`🔧 錯誤詳情: ${errorResponse.error}`);
    
    // 在實際使用中，系統會自動重試或提供替代方案
    console.log('💡 建議: 檢查 API Key 配置並重試');

  } catch (error) {
    console.error('❌ 錯誤處理示例失敗:', error);
  }
}

/**
 * 主要示例執行函數
 */
async function runAllExamples() {
  console.log('🚀 統一 AI Agent 使用示例');
  console.log('=' .repeat(50));
  console.log('這些示例展示了如何在實際專案中使用新的統一 Function Call 系統');
  console.log('');

  try {
    await basicAgentUsage();
    await intelligentToolSelection();
    await toolCategoriesAndSearch();
    await sessionManagementAndStats();
    await apiIntegrationExample();
    await errorHandlingExample();

    console.log('\n✅ 所有示例執行完成！');
    console.log('');
    console.log('🎯 下一步:');
    console.log('1. 將這些模式整合到您的實際專案中');
    console.log('2. 使用真實的 OpenAI API Key 進行測試');
    console.log('3. 根據需求自定義工具選擇邏輯');
    console.log('4. 監控和優化工具調用性能');

  } catch (error) {
    console.error('❌ 示例執行失敗:', error);
  }
}

// 如果直接執行此文件，運行所有示例
if (require.main === module) {
  runAllExamples().catch(console.error);
}

// 導出示例函數供其他模組使用
export {
  basicAgentUsage,
  intelligentToolSelection,
  toolCategoriesAndSearch,
  sessionManagementAndStats,
  apiIntegrationExample,
  errorHandlingExample,
  runAllExamples
}; 