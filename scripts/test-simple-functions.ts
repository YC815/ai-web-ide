#!/usr/bin/env ts-node

/**
 * 簡化的統一 Function Call 系統測試
 */

async function testBasicImports() {
  console.log('🧪 測試基本導入功能...\n');

  try {
    // 測試類型導入
    const types = await import('../src/lib/functions/types');
    console.log('✅ types 模組導入成功');
    console.log(`  - ToolCategory: ${Object.keys(types.ToolCategory).length} 個分類`);
    console.log(`  - FunctionAccessLevel: ${Object.keys(types.FunctionAccessLevel).length} 個權限等級`);

    // 測試分類導入
    const categories = await import('../src/lib/functions/categories');
    console.log('✅ categories 模組導入成功');
    
    // 測試工具註冊表
    const registry = await import('../src/lib/functions/registry');
    console.log('✅ registry 模組導入成功');
    
    // 測試執行器
    const executor = await import('../src/lib/functions/executor');
    console.log('✅ executor 模組導入成功');
    
    return true;
  } catch (error) {
    console.error('❌ 基本導入測試失敗:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 簡化統一 Function Call 系統測試');
  console.log('============================================================\n');

  const basicImportsOk = await testBasicImports();
  
  console.log('\n============================================================');
  console.log('📊 測試總結');
  console.log('============================================================');
  
  if (basicImportsOk) {
    console.log('✅ 基本導入測試通過！');
  } else {
    console.log('❌ 基本導入測試失敗');
    process.exit(1);
  }
}

// 直接執行主函數
main().catch(console.error); 