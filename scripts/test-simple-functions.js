#!/usr/bin/env node

/**
 * 簡化的統一 Function Call 系統測試 (JavaScript 版本)
 */

async function testBasicImports() {
  console.log("🧪 測試基本導入功能...\n");

  try {
    // 測試類型導入
    const types = require("../src/lib/functions/types.ts");
    console.log("✅ types 模組導入成功");

    // 測試分類導入
    const categories = require("../src/lib/functions/categories.ts");
    console.log("✅ categories 模組導入成功");

    return true;
  } catch (error) {
    console.error("❌ 基本導入測試失敗:", error.message);
    return false;
  }
}

async function main() {
  console.log("🚀 簡化統一 Function Call 系統測試 (JavaScript)");
  console.log("============================================================\n");

  const basicImportsOk = await testBasicImports();

  console.log("\n============================================================");
  console.log("📊 測試總結");
  console.log("============================================================");

  if (basicImportsOk) {
    console.log("✅ 基本導入測試通過！");
  } else {
    console.log("❌ 基本導入測試失敗");
    process.exit(1);
  }
}

// 直接執行主函數
main().catch(console.error);
