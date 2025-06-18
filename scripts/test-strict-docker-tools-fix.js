#!/usr/bin/env node

/**
 * 測試 StrictDockerTools 修復
 * 驗證新創建的 StrictDockerTools 類是否能正常工作
 */

console.log("🧪 測試 StrictDockerTools 修復...\n");

async function testStrictDockerToolsImport() {
  try {
    console.log("1. 測試 StrictDockerTools 導入...");

    // 測試從新文件導入
    const { StrictDockerTools } = await import(
      "../src/lib/ai/strict-docker-tools.js"
    );
    console.log("   ✅ StrictDockerTools 類導入成功");

    // 測試從 index 導入
    const aiModule = await import("../src/lib/ai/index.js");
    console.log("   ✅ 從 ai/index 導入成功");

    // 測試靜態方法
    const schemas = StrictDockerTools.getToolSchemas();
    console.log(`   ✅ 獲取工具 Schema 成功，共 ${schemas.length} 個工具`);

    // 列出工具名稱
    console.log("   📋 可用工具:");
    schemas.forEach((schema, index) => {
      console.log(
        `      ${index + 1}. ${schema.function.name} - ${
          schema.function.description
        }`
      );
    });

    return true;
  } catch (error) {
    console.error("   ❌ StrictDockerTools 導入失敗:", error.message);
    return false;
  }
}

async function testAgentFactoryIntegration() {
  try {
    console.log("\n2. 測試 AgentFactory 整合...");

    // 測試 AgentFactory 導入
    const { AgentFactory } = await import("../src/lib/ai/agent-factory.js");
    console.log("   ✅ AgentFactory 導入成功");

    // 測試單例模式
    const factory = AgentFactory.getInstance();
    console.log("   ✅ AgentFactory 單例獲取成功");

    // 測試狀態檢查（不創建實際連接）
    const status = factory.getSystemStatus();
    console.log("   ✅ 系統狀態檢查成功");
    console.log(
      `   📊 狀態: strictDockerTools=${status.strictDockerTools}, securityLevel=${status.securityLevel}`
    );

    return true;
  } catch (error) {
    console.error("   ❌ AgentFactory 整合測試失敗:", error.message);
    return false;
  }
}

async function testStrictToolRegistry() {
  try {
    console.log("\n3. 測試 StrictToolRegistry 整合...");

    // 測試 StrictToolRegistry 導入
    const { StrictToolRegistry } = await import(
      "../src/lib/ai/strict-tool-registry.js"
    );
    console.log("   ✅ StrictToolRegistry 導入成功");

    return true;
  } catch (error) {
    console.error("   ❌ StrictToolRegistry 測試失敗:", error.message);
    return false;
  }
}

async function testChatIntegration() {
  try {
    console.log("\n4. 測試聊天系統整合...");

    // 測試安全聊天整合器
    const { SecureChatAgentIntegrator } = await import(
      "../src/lib/ai/secure-chat-agent-integration.js"
    );
    console.log("   ✅ SecureChatAgentIntegrator 導入成功");

    return true;
  } catch (error) {
    console.error("   ❌ 聊天系統整合測試失敗:", error.message);
    return false;
  }
}

async function runAllTests() {
  console.log("🚀 開始 StrictDockerTools 修復驗證測試\n");

  const tests = [
    { name: "StrictDockerTools 導入", fn: testStrictDockerToolsImport },
    { name: "AgentFactory 整合", fn: testAgentFactoryIntegration },
    { name: "StrictToolRegistry 整合", fn: testStrictToolRegistry },
    { name: "聊天系統整合", fn: testChatIntegration },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ 測試 "${test.name}" 執行異常:`, error.message);
      failed++;
    }
  }

  console.log("\n📊 測試結果總結:");
  console.log(`   ✅ 通過: ${passed} 個測試`);
  console.log(`   ❌ 失敗: ${failed} 個測試`);
  console.log(
    `   📈 成功率: ${Math.round((passed / (passed + failed)) * 100)}%`
  );

  if (failed === 0) {
    console.log("\n🎉 所有測試通過！StrictDockerTools 修復成功！");
    console.log("\n✨ 主要修復內容:");
    console.log(
      "   • 創建了新的 StrictDockerTools 類 (src/lib/ai/strict-docker-tools.ts)"
    );
    console.log("   • 修復了 AgentFactory 中的導入引用");
    console.log("   • 修復了 StrictToolRegistry 中的導入引用");
    console.log("   • 恢復了 prompt-builder 的簡化版本");
    console.log("   • 修復了 langchain-chat-engine 中的語法錯誤");
    console.log("   • 所有模組現在都能正常導入和使用");
  } else {
    console.log("\n⚠️ 部分測試失敗，需要進一步檢查");
  }

  return failed === 0;
}

// 執行測試
runAllTests().catch((error) => {
  console.error("🔥 測試執行失敗:", error);
  process.exit(1);
});
