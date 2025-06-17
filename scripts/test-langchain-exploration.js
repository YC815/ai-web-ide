#!/usr/bin/env node

// Langchain 專案探索功能測試
// 驗證自動路徑檢測和完整探索功能

const {
  createLangchainChatEngine,
} = require("../src/lib/ai/langchain-chat-engine");
const { createAIContextManager } = require("../src/lib/ai/context-manager");

async function testLangchainExploration() {
  console.log("🧪 開始 Langchain 專案探索測試...\n");

  // 模擬項目上下文
  const contextManager = createAIContextManager({
    projectId: "test-project",
    projectName: "ai_creator",
    workingDirectory: process.cwd(),
    environment: "development",
  });

  const projectContext = {
    projectId: "test-project",
    projectName: "ai_creator",
    workingDirectory: process.cwd(),
    contextManager,
  };

  // 創建 Langchain 引擎
  const chatEngine = createLangchainChatEngine(
    process.env.OPENAI_API_KEY || "test-key",
    {
      model: "gpt-4o",
      temperature: 0.1,
      maxTokens: 100000,
    }
  );

  const testCases = [
    {
      name: "測試專案探索觸發",
      message: "查看本專案目錄",
      expectedTools: ["comprehensive_project_exploration"],
    },
    {
      name: "測試路徑檢測",
      message: "專案在哪個目錄？",
      expectedTools: ["detect_project_path"],
    },
    {
      name: "測試檔案架構分析",
      message: "分析專案結構",
      expectedTools: ["comprehensive_project_exploration"],
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 測試案例: ${testCase.name}`);
    console.log(`📝 用戶訊息: "${testCase.message}"`);
    console.log(`🎯 預期工具: ${testCase.expectedTools.join(", ")}`);

    try {
      const response = await chatEngine.processMessage(
        "test-session",
        testCase.message,
        projectContext
      );

      console.log("✅ 回應生成成功");
      console.log(`📊 訊息長度: ${response.message.length} 字元`);

      if (response.toolCalls && response.toolCalls.length > 0) {
        console.log("🔧 使用的工具:");
        response.toolCalls.forEach((call) => {
          console.log(`  - ${call.tool}: ${call.success ? "✅" : "❌"}`);
        });
      } else {
        console.log("⚠️ 沒有使用任何工具");
      }

      if (response.thoughtProcess) {
        console.log(`🧠 AI 決策: ${response.thoughtProcess.decision}`);
        console.log(`🎯 信心度: ${response.thoughtProcess.confidence}`);
      }

      if (response.autoActions && response.autoActions.length > 0) {
        console.log(`⚡ 自動執行動作: ${response.autoActions.length} 個`);
      }

      // 檢查是否包含完整的專案分析
      const hasProjectInfo =
        response.message.includes("專案") &&
        response.message.includes("目錄") &&
        response.message.length > 500;

      if (hasProjectInfo) {
        console.log("✅ 包含完整專案分析");
      } else {
        console.log("❌ 專案分析不夠完整");
      }
    } catch (error) {
      console.error(`❌ 測試失敗: ${error.message}`);
    }

    console.log("\n" + "─".repeat(60));
  }

  console.log("\n🎉 Langchain 探索測試完成！");
}

// 執行測試
if (require.main === module) {
  testLangchainExploration().catch(console.error);
}

module.exports = { testLangchainExploration };
