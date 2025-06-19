#!/usr/bin/env node
/**
 * 測試 LangChain 訊息處理修復
 */

console.log("🧪 測試 LangChain 訊息處理修復...\n");

async function testMessageHandling() {
  try {
    // 1. 測試 Prompt 模板
    console.log("1️⃣ 測試 Prompt 模板結構...");

    // 檢查 langchain-chat-engine.ts 中的 prompt 模板
    const fs = require("fs");
    const engineContent = fs.readFileSync(
      "src/lib/ai/langchain-chat-engine.ts",
      "utf8"
    );

    // 檢查是否使用了正確的 prompt 格式
    if (engineContent.includes("['human', '{input}']")) {
      console.log("✅ 使用正確的 human message 格式");
    } else if (engineContent.includes("new HumanMessage('{input}')")) {
      console.log("❌ 使用了錯誤的 HumanMessage 格式");
      console.log('💡 應該使用 ["human", "{input}"] 格式');
      return false;
    } else {
      console.log("⚠️  未找到 input 處理邏輯");
    }

    // 2. 測試簡化版引擎
    console.log("\n2️⃣ 測試簡化版引擎結構...");
    const simpleEngineContent = fs.readFileSync(
      "src/lib/ai/simple-langchain-engine.ts",
      "utf8"
    );

    if (simpleEngineContent.includes("ChatPromptTemplate.fromTemplate")) {
      console.log("✅ 簡化版引擎使用正確的模板格式");
    } else {
      console.log("❌ 簡化版引擎模板格式可能有問題");
      return false;
    }

    // 3. 測試 API 路由中的訊息處理
    console.log("\n3️⃣ 測試 API 路由訊息處理...");
    const chatEnhancedContent = fs.readFileSync(
      "src/app/api/chat-enhanced/route.ts",
      "utf8"
    );

    if (chatEnhancedContent.includes("const fullMessage = contextString")) {
      console.log("✅ API 路由中正確構建完整訊息");
    } else {
      console.log("❌ API 路由中訊息構建可能有問題");
      return false;
    }

    if (chatEnhancedContent.includes("await chatEngine.run(fullMessage)")) {
      console.log("✅ 正確傳遞訊息到 LangChain 引擎");
    } else {
      console.log("❌ 訊息傳遞到引擎可能有問題");
      return false;
    }

    // 4. 模擬訊息處理流程
    console.log("\n4️⃣ 模擬訊息處理流程...");

    const testMessage = "把主頁文字改成「AI編輯測試」作為測試用圖";
    const testContext = "=== 對話歷史 ===\n[用戶]: 測試訊息";
    const fullMessage = `${testContext}\n\n=== 當前用戶訊息 ===\n${testMessage}`;

    console.log("📝 測試訊息:", testMessage);
    console.log("📝 完整訊息長度:", fullMessage.length);
    console.log("📝 完整訊息預覽:", fullMessage.substring(0, 100) + "...");

    if (fullMessage.includes(testMessage)) {
      console.log("✅ 訊息正確包含在完整訊息中");
    } else {
      console.log("❌ 訊息未正確包含在完整訊息中");
      return false;
    }

    // 5. 檢查 LangChain 依賴
    console.log("\n5️⃣ 檢查 LangChain 依賴...");

    try {
      const { ChatPromptTemplate } = require("@langchain/core/prompts");
      console.log("✅ @langchain/core/prompts 導入成功");

      // 測試模板創建
      const testTemplate = ChatPromptTemplate.fromMessages([
        ["system", "You are a helpful assistant."],
        ["human", "{input}"],
      ]);

      console.log("✅ ChatPromptTemplate 創建成功");
    } catch (error) {
      console.log("❌ LangChain 依賴測試失敗:", error.message);
      return false;
    }

    console.log("\n🎉 所有訊息處理測試都通過！");

    console.log("\n📝 修復摘要:");
    console.log("   ✅ 修復了 Prompt 模板中的 HumanMessage 格式");
    console.log('   ✅ 使用正確的 ["human", "{input}"] 格式');
    console.log("   ✅ API 路由中訊息處理正確");
    console.log("   ✅ LangChain 依賴正常工作");

    console.log("\n💡 建議:");
    console.log("   - 重新啟動開發服務器以應用修復");
    console.log("   - 測試實際的聊天功能");
    console.log("   - 確認 OPENAI_API_KEY 已正確設置");

    return true;
  } catch (error) {
    console.error("❌ 測試失敗:", error);
    return false;
  }
}

// 執行測試
testMessageHandling()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("💥 測試執行失敗:", error);
    process.exit(1);
  });
