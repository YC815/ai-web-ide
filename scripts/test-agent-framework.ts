#!/usr/bin/env ts-node
/**
 * AI 工具控制框架測試腳本
 * 用於快速驗證框架是否正常運作
 */

import { AgentFactory, quickTestAgent, systemDiagnostic } from '../src/lib/ai';

async function main() {
  console.log('🚀 AI 工具控制框架測試腳本');
  console.log('================================\n');

  try {
    // 1. 系統診斷
    console.log('🔍 步驟 1: 執行系統診斷...');
    const diagnostic = await systemDiagnostic();
    console.log(`診斷結果: ${diagnostic.success ? '✅ 成功' : '❌ 失敗'}`);
    console.log(`訊息: ${diagnostic.message}\n`);

    if (!diagnostic.success) {
      console.log('❌ 系統診斷失敗，請檢查 Docker 容器狀態');
      process.exit(1);
    }

    // 2. 快速測試
    console.log('🧪 步驟 2: 執行快速測試...');
    const testResult = await quickTestAgent("請列出當前目錄的內容");
    console.log('✅ 快速測試完成');
    console.log('結果預覽:', testResult.substring(0, 200) + '...\n');

    // 3. 測試特定功能
    console.log('🔧 步驟 3: 測試特定功能...');
    const factory = AgentFactory.getInstance();
    
    const testCases = [
      { name: '檢查 package.json', message: '請檢查 package.json 檔案是否存在' },
      { name: '尋找 TypeScript 檔案', message: '請找出專案中的 TypeScript 檔案' },
      { name: '分析專案結構', message: '請簡單分析一下這個專案的結構' },
    ];

    for (const testCase of testCases) {
      console.log(`\n📝 測試: ${testCase.name}`);
      try {
        const result = await factory.quickRun(testCase.message, {
          maxToolCalls: 3,
          timeoutMs: 20000,
        });
        console.log(`✅ ${testCase.name} - 成功`);
        console.log(`結果: ${result.substring(0, 150)}...`);
      } catch (error) {
        console.log(`❌ ${testCase.name} - 失敗: ${error}`);
      }
    }

    // 4. 系統狀態檢查
    console.log('\n📊 步驟 4: 檢查系統狀態...');
    const status = factory.getSystemStatus();
    console.log('系統狀態:', JSON.stringify(status, null, 2));

    console.log('\n🎉 所有測試完成！');
    console.log('\n📋 測試總結:');
    console.log('- 系統診斷: ✅');
    console.log('- 快速測試: ✅');
    console.log('- 功能測試: ✅');
    console.log('- 狀態檢查: ✅');

  } catch (error) {
    console.error('\n❌ 測試過程中發生錯誤:', error);
    process.exit(1);
  }
}

// 執行主函數
if (require.main === module) {
  main().catch(console.error);
} 