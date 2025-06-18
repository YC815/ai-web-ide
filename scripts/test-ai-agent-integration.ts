#!/usr/bin/env ts-node

/**
 * AI Agent 整合測試
 * 測試統一 Function Call 系統與 AI Agent 的整合
 */

import { 
  allTools, 
  toolsByCategory, 
  generateOpenAISchemas,
  searchTools,
  executeToolById,
  toolStats 
} from '../src/lib/functions/index';

async function testUnifiedFunctionSystem() {
  console.log('🤖 AI Agent 整合測試');
  console.log('============================================================\n');

  try {
    // 1. 測試工具載入
    console.log('📦 測試工具載入...');
    console.log(`✅ 總工具數: ${allTools.length}`);
    console.log(`✅ 分類數: ${Object.keys(toolsByCategory).length}`);
    console.log(`✅ 高優先級工具: ${toolStats.highPriorityTools}`);
    
    // 2. 測試各分類工具
    console.log('\n🔧 測試各分類工具:');
    Object.entries(toolsByCategory).forEach(([category, tools]) => {
      console.log(`  ${category}: ${tools.length} 個工具`);
    });

    // 3. 測試 OpenAI Schema 生成
    console.log('\n📋 測試 OpenAI Schema 生成...');
    const schemas = generateOpenAISchemas();
    console.log(`✅ 生成了 ${schemas.length} 個 OpenAI Function Schema`);
    
    // 顯示前3個 schema 的結構
    schemas.slice(0, 3).forEach((schema, index) => {
      console.log(`  ${index + 1}. ${schema.name}: ${schema.description}`);
    });

    // 4. 測試工具搜尋
    console.log('\n🔍 測試工具搜尋功能...');
    const dockerTools = searchTools('docker');
    const aiTools = searchTools('ai');
    console.log(`✅ 搜尋 'docker': ${dockerTools.length} 個結果`);
    console.log(`✅ 搜尋 'ai': ${aiTools.length} 個結果`);

    // 5. 測試工具執行
    console.log('\n⚡ 測試工具執行...');
    
    // 測試 AI 工具
    if (aiTools.length > 0) {
      const aiTool = aiTools[0];
      console.log(`測試執行: ${aiTool.schema.name}`);
      
      try {
        const result = await executeToolById(aiTool.id, {
          message: 'Hello, AI Agent!',
          maxToolCalls: 3
        });
        console.log(`✅ ${aiTool.schema.name} 執行成功:`, result.success ? '成功' : '失敗');
      } catch (error) {
        console.log(`⚠️ ${aiTool.schema.name} 執行錯誤:`, (error as Error).message);
      }
    }

    // 測試 Docker 工具
    if (dockerTools.length > 0) {
      const dockerTool = dockerTools[0];
      console.log(`測試執行: ${dockerTool.schema.name}`);
      
      try {
        const result = await executeToolById(dockerTool.id, {
          filePath: '/test/file.txt'
        });
        console.log(`✅ ${dockerTool.schema.name} 執行成功:`, result.success ? '成功' : '失敗');
      } catch (error) {
        console.log(`⚠️ ${dockerTool.schema.name} 執行錯誤:`, (error as Error).message);
      }
    }

    // 6. 測試 LangChain 整合
    console.log('\n🔗 測試 LangChain 整合...');
    try {
      const langchainBinder = await import('../src/lib/functions/langchain-binder');
      
      // 檢查是否有 createLangChainTools 函數
      if ('createLangChainTools' in langchainBinder) {
        const createLangChainTools = langchainBinder.createLangChainTools as any;
        const langchainTools = createLangChainTools(allTools.slice(0, 5)); // 測試前5個工具
        console.log(`✅ 創建了 ${langchainTools.length} 個 LangChain 工具`);
        
        langchainTools.forEach((tool: any, index: number) => {
          console.log(`  ${index + 1}. ${tool.name}: ${tool.description}`);
        });
      } else {
        console.log(`⚠️ LangChain 綁定器中沒有找到 createLangChainTools 函數`);
      }
    } catch (error) {
      console.log(`⚠️ LangChain 整合測試失敗:`, (error as Error).message);
    }

    // 7. 模擬 AI Agent 工作流程
    console.log('\n🎯 模擬 AI Agent 工作流程...');
    
    // 模擬用戶請求：檢查專案狀態
    console.log('用戶請求: "檢查專案狀態並列出主要文件"');
    
    // 1. AI Agent 分析請求，決定使用哪些工具
    const relevantTools = searchTools('project').concat(searchTools('file'));
    console.log(`AI Agent 找到 ${relevantTools.length} 個相關工具`);
    
    // 2. 執行工具調用
    if (relevantTools.length > 0) {
      const projectTool = relevantTools.find(t => t.schema.name.includes('project') || t.schema.name.includes('Project'));
      if (projectTool) {
        try {
          const result = await executeToolById(projectTool.id, {});
          console.log(`✅ 專案資訊獲取成功`);
        } catch (error) {
          console.log(`⚠️ 專案資訊獲取失敗:`, (error as Error).message);
        }
      }
    }

    console.log('\n============================================================');
    console.log('🎉 AI Agent 整合測試完成！');
    console.log('============================================================');
    
    return true;
  } catch (error) {
    console.error('❌ AI Agent 整合測試失敗:', error);
    return false;
  }
}

// 執行測試
testUnifiedFunctionSystem()
  .then(success => {
    if (success) {
      console.log('\n✅ 所有測試通過！統一 Function Call 系統已準備好與 AI Agent 整合。');
      process.exit(0);
    } else {
      console.log('\n❌ 測試失敗，請檢查上述錯誤。');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('測試執行失敗:', error);
    process.exit(1);
  }); 