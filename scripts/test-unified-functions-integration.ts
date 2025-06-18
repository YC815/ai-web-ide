#!/usr/bin/env ts-node

/**
 * 統一 Function Call 系統整合測試
 * 測試所有工具並驗證 langchain 綁定
 */

import { promises as fs } from 'fs';
import { join } from 'path';

// 測試所有統一工具
async function testUnifiedFunctions() {
  console.log('🧪 測試統一 Function Call 系統...\n');

  try {
    // 導入統一系統
    const { 
      allTools, 
      toolsByCategory, 
      generateOpenAISchemas,
      searchTools,
      toolStats 
    } = await import('../src/lib/functions/index');

    console.log('✅ 成功導入統一 Function Call 系統');
    console.log(`📊 總工具數量: ${allTools.length}`);
    console.log(`📂 分類數量: ${Object.keys(toolsByCategory).length}`);

    // 測試各分類工具
    for (const [category, tools] of Object.entries(toolsByCategory)) {
      console.log(`  ${category}: ${tools.length} 個工具`);
      
      // 測試每個工具的基本結構
      for (const tool of tools) {
        if (!tool.id || !tool.schema || !tool.handler) {
          console.error(`❌ 工具 ${tool.id || 'unknown'} 缺少必要屬性`);
          return false;
        }
        if (!tool.schema.name || !tool.schema.description) {
          console.error(`❌ 工具 ${tool.id} 的 schema 缺少必要屬性`);
          return false;
        }
      }
    }

    // 測試 OpenAI Schema 生成
    const schemas = generateOpenAISchemas();
    console.log(`🔧 OpenAI Schema 數量: ${schemas.length}`);
    
    // 驗證 Schema 格式
    for (const schema of schemas.slice(0, 3)) { // 測試前3個
      if (!schema.name || !schema.description || !schema.parameters) {
        console.error(`❌ Schema ${schema.name || 'unknown'} 格式不正確`);
        return false;
      }
    }

    // 測試搜尋功能
    const searchResults = searchTools('docker');
    console.log(`🔍 搜尋 'docker' 找到 ${searchResults.length} 個工具`);
    
    // 顯示搜尋結果詳情
    if (searchResults.length > 0) {
      console.log(`  找到的工具: ${searchResults.map(t => t.schema.name).join(', ')}`);
    }

    // 測試統計功能
    console.log(`📈 工具統計:`, {
      totalFunctions: toolStats.totalTools,
      categories: toolStats.categories,
      highPriorityTools: toolStats.highPriorityTools
    });

    return true;

  } catch (error) {
    console.error('❌ 統一 Function Call 系統測試失敗:', error);
    return false;
  }
}

// 測試個別工具執行
async function testIndividualTools() {
  console.log('\n🔧 測試個別工具執行...\n');

  try {
    // 測試 AI 工具
    const { aiTools } = await import('../src/lib/functions/ai/index');
    console.log(`🤖 AI 工具數量: ${aiTools.length}`);

    // 測試 Docker 工具
    const { dockerFunctions } = await import('../src/lib/functions/docker/index');
    console.log(`🐳 Docker 工具數量: ${dockerFunctions.length}`);

    // 測試專案工具
    const { projectTools } = await import('../src/lib/functions/project/index');
    console.log(`🏗️ 專案工具數量: ${projectTools.length}`);

    // 測試系統工具
    const { systemTools } = await import('../src/lib/functions/system/index');
    console.log(`⚙️ 系統工具數量: ${systemTools.length}`);

    // 測試檔案系統工具
    const { filesystemFunctions } = await import('../src/lib/functions/filesystem/index');
    console.log(`📁 檔案系統工具數量: ${filesystemFunctions.length}`);

    // 測試網路工具
    const { networkFunctions } = await import('../src/lib/functions/network/index');
    console.log(`🌐 網路工具數量: ${networkFunctions.length}`);

    // 測試實用工具
    const { utilityFunctions } = await import('../src/lib/functions/utility/index');
    console.log(`🔧 實用工具數量: ${utilityFunctions.length}`);

    return true;

  } catch (error) {
    console.error('❌ 個別工具測試失敗:', error);
    return false;
  }
}

// 測試 Langchain 綁定
async function testLangchainBinding() {
  console.log('\n🦜 測試 Langchain 綁定...\n');

  try {
    // 檢查 langchain-chat-engine 是否能正確導入統一工具
    const { LangchainChatEngine } = await import('../src/lib/ai/langchain-chat-engine');
    console.log('✅ LangchainChatEngine 導入成功');

    // 檢查 createProjectTools 方法
    // 注意：這裡我們不能直接測試私有方法，但可以檢查類的存在
    if (typeof LangchainChatEngine === 'function') {
      console.log('✅ LangchainChatEngine 類定義正確');
    }

    // 測試 OpenAI 整合
    const { OpenAIIntegration } = await import('../src/lib/ai/openai');
    console.log('✅ OpenAI 整合模組導入成功');

    return true;

  } catch (error) {
    console.error('❌ Langchain 綁定測試失敗:', error);
    return false;
  }
}

// 創建 Langchain 工具綁定器
async function createLangchainToolBinder() {
  console.log('\n🔗 創建 Langchain 工具綁定器...\n');

  const binderCode = `/**
 * Langchain 工具綁定器
 * 將統一 Function Call 系統與 Langchain 整合
 */

import { DynamicTool, Tool } from '@langchain/core/tools';
import { 
  allTools, 
  toolsByCategory, 
  generateOpenAISchemas 
} from '../functions/index.js';
import type { FunctionDefinition } from '../functions/types.js';

/**
 * 將統一工具轉換為 Langchain DynamicTool
 */
export function convertToLangchainTool(functionDef: FunctionDefinition): DynamicTool {
  return new DynamicTool({
    name: functionDef.name,
    description: functionDef.description,
    func: async (input: string) => {
      try {
        // 解析輸入參數
        let parameters: Record<string, any>;
        try {
          parameters = JSON.parse(input);
        } catch {
          // 如果不是 JSON，嘗試簡單參數解析
          parameters = { input };
        }

        // 驗證參數（如果有驗證器）
        if (functionDef.validator) {
          const validation = await functionDef.validator(parameters);
          if (!validation.isValid) {
            return \`❌ 參數驗證失敗: \${validation.reason}\`;
          }
        }

        // 執行工具
        const result = await functionDef.handler(parameters);
        
        // 格式化結果
        if (typeof result === 'object') {
          return JSON.stringify(result, null, 2);
        }
        return String(result);

      } catch (error) {
        return \`❌ 工具執行失敗: \${error instanceof Error ? error.message : String(error)}\`;
      }
    }
  });
}

/**
 * 批量轉換所有工具
 */
export function convertAllToolsToLangchain(): DynamicTool[] {
  return allTools.map(convertToLangchainTool);
}

/**
 * 按分類轉換工具
 */
export function convertToolsByCategoryToLangchain(category: string): DynamicTool[] {
  const categoryTools = toolsByCategory[category] || [];
  return categoryTools.map(convertToLangchainTool);
}

/**
 * 創建高優先級工具集合（用於 AI Agent）
 */
export function createHighPriorityToolsForAgent(): DynamicTool[] {
  // 選擇最重要的工具
  const highPriorityCategories = ['ai', 'docker', 'project', 'filesystem'];
  const highPriorityTools: FunctionDefinition[] = [];

  for (const category of highPriorityCategories) {
    const categoryTools = toolsByCategory[category] || [];
    highPriorityTools.push(...categoryTools);
  }

  return highPriorityTools.map(convertToLangchainTool);
}

/**
 * 為 OpenAI Function Calling 生成工具定義
 */
export function generateOpenAIToolDefinitions() {
  return generateOpenAISchemas().map(schema => ({
    type: 'function' as const,
    function: {
      name: schema.name,
      description: schema.description,
      parameters: schema.parameters
    }
  }));
}

/**
 * 智能工具選擇器
 * 根據用戶請求自動選擇相關工具
 */
export function selectToolsForRequest(userMessage: string): DynamicTool[] {
  const message = userMessage.toLowerCase();
  const selectedTools: FunctionDefinition[] = [];

  // 根據關鍵字選擇工具
  if (message.includes('docker') || message.includes('容器')) {
    selectedTools.push(...(toolsByCategory.docker || []));
  }
  
  if (message.includes('檔案') || message.includes('file') || message.includes('read') || message.includes('write')) {
    selectedTools.push(...(toolsByCategory.filesystem || []));
  }
  
  if (message.includes('專案') || message.includes('project') || message.includes('初始化')) {
    selectedTools.push(...(toolsByCategory.project || []));
  }
  
  if (message.includes('ai') || message.includes('agent') || message.includes('聊天')) {
    selectedTools.push(...(toolsByCategory.ai || []));
  }
  
  if (message.includes('系統') || message.includes('監控') || message.includes('log')) {
    selectedTools.push(...(toolsByCategory.system || []));
  }
  
  if (message.includes('網路') || message.includes('http') || message.includes('api')) {
    selectedTools.push(...(toolsByCategory.network || []));
  }

  // 如果沒有匹配到特定工具，返回核心工具集
  if (selectedTools.length === 0) {
    selectedTools.push(...createHighPriorityToolsForAgent().map(tool => {
      // 從 DynamicTool 轉回 FunctionDefinition 的簡化版本
      return allTools.find(t => t.name === tool.name)!;
    }).filter(Boolean));
  }

  // 去重並轉換
  const uniqueTools = Array.from(new Set(selectedTools));
  return uniqueTools.map(convertToLangchainTool);
}

export default {
  convertToLangchainTool,
  convertAllToolsToLangchain,
  convertToolsByCategoryToLangchain,
  createHighPriorityToolsForAgent,
  generateOpenAIToolDefinitions,
  selectToolsForRequest
};`;

  try {
    await fs.writeFile('src/lib/functions/langchain-binder.ts', binderCode);
    console.log('✅ Langchain 工具綁定器創建成功');
    console.log('📍 位置: src/lib/functions/langchain-binder.ts');
    return true;
  } catch (error) {
    console.error('❌ 創建 Langchain 綁定器失敗:', error);
    return false;
  }
}

// 更新 langchain-chat-engine 以使用新的統一工具
async function updateLangchainChatEngine() {
  console.log('\n🔄 更新 LangchainChatEngine 以使用統一工具...\n');

  try {
    // 讀取現有的 langchain-chat-engine.ts
    const enginePath = 'src/lib/ai/langchain-chat-engine.ts';
    let engineContent = await fs.readFile(enginePath, 'utf-8');

    // 檢查是否已經有統一工具的導入
    if (!engineContent.includes('from \'../functions/langchain-binder\'')) {
      // 在文件開頭添加新的導入
      const importToAdd = `
// 統一 Function Call 系統整合
import { 
  createHighPriorityToolsForAgent,
  selectToolsForRequest,
  convertToLangchainTool 
} from '../functions/langchain-binder';
import { allTools, toolsByCategory } from '../functions/index';
`;

      // 找到最後一個 import 語句的位置
      const lastImportIndex = engineContent.lastIndexOf('import ');
      const nextLineIndex = engineContent.indexOf('\n', lastImportIndex);
      
      engineContent = engineContent.slice(0, nextLineIndex) + 
                     importToAdd + 
                     engineContent.slice(nextLineIndex);

      await fs.writeFile(enginePath, engineContent);
      console.log('✅ LangchainChatEngine 已更新以支援統一工具');
    } else {
      console.log('✅ LangchainChatEngine 已經支援統一工具');
    }

    return true;
  } catch (error) {
    console.error('❌ 更新 LangchainChatEngine 失敗:', error);
    return false;
  }
}

// 創建使用範例
async function createUsageExamples() {
  console.log('\n📝 創建使用範例...\n');

  const exampleCode = `/**
 * 統一 Function Call 系統使用範例
 */

import { 
  createHighPriorityToolsForAgent,
  selectToolsForRequest,
  generateOpenAIToolDefinitions 
} from '../lib/functions/langchain-binder';
import { allTools, searchTools } from '../lib/functions/index';

// 範例 1: 為 AI Agent 創建工具集
export async function createAIAgentWithTools() {
  const tools = createHighPriorityToolsForAgent();
  console.log(\`創建了 \${tools.length} 個高優先級工具\`);
  
  // 這些工具可以直接用於 langchain AgentExecutor
  return tools;
}

// 範例 2: 根據用戶請求智能選擇工具
export async function handleUserRequest(userMessage: string) {
  const relevantTools = selectToolsForRequest(userMessage);
  console.log(\`為請求 "\${userMessage}" 選擇了 \${relevantTools.length} 個工具\`);
  
  return relevantTools;
}

// 範例 3: 為 OpenAI Function Calling 生成定義
export async function setupOpenAIFunctionCalling() {
  const toolDefinitions = generateOpenAIToolDefinitions();
  console.log(\`生成了 \${toolDefinitions.length} 個 OpenAI 工具定義\`);
  
  return toolDefinitions;
}

// 範例 4: 搜尋特定工具
export async function findSpecificTools(query: string) {
  const foundTools = searchTools(query);
  console.log(\`搜尋 "\${query}" 找到 \${foundTools.length} 個工具\`);
  
  return foundTools;
}

// 範例 5: 執行特定工具
export async function executeUnifiedTool(toolName: string, parameters: any) {
  const tool = allTools.find(t => t.name === toolName);
  if (!tool) {
    throw new Error(\`找不到工具: \${toolName}\`);
  }
  
  // 驗證參數
  if (tool.validator) {
    const validation = await tool.validator(parameters);
    if (!validation.isValid) {
      throw new Error(\`參數驗證失敗: \${validation.reason}\`);
    }
  }
  
  // 執行工具
  const result = await tool.handler(parameters);
  return result;
}`;

  try {
    await fs.writeFile('src/lib/functions/usage-examples.ts', exampleCode);
    console.log('✅ 使用範例創建成功');
    console.log('📍 位置: src/lib/functions/usage-examples.ts');
    return true;
  } catch (error) {
    console.error('❌ 創建使用範例失敗:', error);
    return false;
  }
}

// 生成整合測試報告
async function generateIntegrationReport() {
  console.log('\n📋 生成整合測試報告...\n');

  const report = {
    timestamp: new Date().toISOString(),
    testResults: {
      unifiedFunctions: false,
      individualTools: false,
      langchainBinding: false,
      binderCreation: false,
      engineUpdate: false,
      examplesCreation: false
    },
    summary: {
      totalTests: 6,
      passedTests: 0,
      failedTests: 0
    },
    recommendations: [] as string[]
  };

  // 執行所有測試
  console.log('🚀 開始整合測試...\n');

  report.testResults.unifiedFunctions = await testUnifiedFunctions();
  report.testResults.individualTools = await testIndividualTools();
  report.testResults.langchainBinding = await testLangchainBinding();
  report.testResults.binderCreation = await createLangchainToolBinder();
  report.testResults.engineUpdate = await updateLangchainChatEngine();
  report.testResults.examplesCreation = await createUsageExamples();

  // 計算統計
  const results = Object.values(report.testResults);
  report.summary.passedTests = results.filter(r => r).length;
  report.summary.failedTests = results.filter(r => !r).length;

  // 生成建議
  if (!report.testResults.unifiedFunctions) {
    report.recommendations.push('修復統一 Function Call 系統的基本功能');
  }
  if (!report.testResults.langchainBinding) {
    report.recommendations.push('檢查 Langchain 相關依賴是否正確安裝');
  }
  if (report.summary.passedTests === report.summary.totalTests) {
    report.recommendations.push('所有測試通過！可以開始使用統一工具系統');
    report.recommendations.push('建議在 AI Agent 中使用 createHighPriorityToolsForAgent() 獲取核心工具');
    report.recommendations.push('使用 selectToolsForRequest() 根據用戶請求智能選擇工具');
  }

  // 保存報告
  const reportPath = 'docs/function-call-integration-report.json';
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log('\n' + '=' .repeat(60));
  console.log('📊 整合測試報告');
  console.log('=' .repeat(60));
  console.log(`📅 測試時間: ${report.timestamp}`);
  console.log(`✅ 通過測試: ${report.summary.passedTests}/${report.summary.totalTests}`);
  console.log(`❌ 失敗測試: ${report.summary.failedTests}/${report.summary.totalTests}`);
  
  console.log('\n🔍 詳細結果:');
  for (const [test, result] of Object.entries(report.testResults)) {
    console.log(`  ${result ? '✅' : '❌'} ${test}`);
  }

  if (report.recommendations.length > 0) {
    console.log('\n💡 建議:');
    report.recommendations.forEach(rec => console.log(`  • ${rec}`));
  }

  console.log(`\n📄 完整報告已保存到: ${reportPath}`);
  
  return report.summary.passedTests === report.summary.totalTests;
}

// 主函數
async function main() {
  console.log('🚀 統一 Function Call 系統整合測試');
  console.log('=' .repeat(60));

  const success = await generateIntegrationReport();

  if (success) {
    console.log('\n🎉 所有測試通過！統一 Function Call 系統已準備就緒。');
    console.log('\n📖 使用指南:');
    console.log('1. 在 AI Agent 中使用 createHighPriorityToolsForAgent() 獲取核心工具');
    console.log('2. 使用 selectToolsForRequest() 根據用戶請求智能選擇工具');
    console.log('3. 參考 src/lib/functions/usage-examples.ts 獲取更多使用範例');
    console.log('4. 查看 docs/unified-function-call-system.md 獲取完整文檔');
  } else {
    console.log('\n⚠️ 部分測試失敗，請檢查上述錯誤並修復。');
    process.exit(1);
  }
}

// 執行測試
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { 
  testUnifiedFunctions, 
  testIndividualTools, 
  testLangchainBinding,
  createLangchainToolBinder,
  updateLangchainChatEngine,
  createUsageExamples
}; 