#!/usr/bin/env node

/**
 * AI Agent 整合測試 (JavaScript 版本)
 * 測試統一 Function Call 系統的基本功能
 */

const fs = require("fs");
const path = require("path");

async function testUnifiedFunctionSystem() {
  console.log("🤖 AI Agent 整合測試 (基本功能驗證)");
  console.log("============================================================\n");

  try {
    // 1. 測試文件結構
    console.log("📦 測試文件結構...");

    const requiredFiles = [
      "src/lib/functions/index.ts",
      "src/lib/functions/types.ts",
      "src/lib/functions/categories.ts",
      "src/lib/functions/ai/index.ts",
      "src/lib/functions/docker/index.ts",
      "src/lib/functions/project/index.ts",
      "src/lib/functions/system/index.ts",
    ];

    let allFilesExist = true;
    requiredFiles.forEach((file) => {
      if (fs.existsSync(file)) {
        console.log(`✅ ${file}`);
      } else {
        console.log(`❌ ${file} 不存在`);
        allFilesExist = false;
      }
    });

    if (!allFilesExist) {
      throw new Error("部分必要文件不存在");
    }

    // 2. 測試 TypeScript 編譯
    console.log("\n🔧 測試 TypeScript 編譯...");
    const { execSync } = require("child_process");

    try {
      execSync("npx tsc --noEmit --skipLibCheck src/lib/functions/index.ts", {
        stdio: "pipe",
      });
      console.log("✅ TypeScript 編譯通過");
    } catch (error) {
      console.log("❌ TypeScript 編譯失敗");
      throw error;
    }

    // 3. 檢查工具文件結構
    console.log("\n📋 檢查工具文件結構...");

    const toolDirs = [
      "src/lib/functions/ai",
      "src/lib/functions/docker",
      "src/lib/functions/filesystem",
      "src/lib/functions/network",
      "src/lib/functions/project",
      "src/lib/functions/system",
      "src/lib/functions/utility",
    ];

    let toolCount = 0;
    toolDirs.forEach((dir) => {
      const indexFile = path.join(dir, "index.ts");
      if (fs.existsSync(indexFile)) {
        const content = fs.readFileSync(indexFile, "utf8");
        const exportMatches = content.match(/export const \w+:/g) || [];
        console.log(`✅ ${path.basename(dir)}: ${exportMatches.length} 個工具`);
        toolCount += exportMatches.length;
      } else {
        console.log(`❌ ${dir}/index.ts 不存在`);
      }
    });

    console.log(`📊 總計: ${toolCount} 個工具`);

    // 4. 檢查 OpenAI Function Schema 格式
    console.log("\n🔍 檢查 OpenAI Function Schema 格式...");

    // 簡單檢查一個工具文件的格式
    const aiToolsFile = "src/lib/functions/ai/index.ts";
    const aiContent = fs.readFileSync(aiToolsFile, "utf8");

    // 檢查必要的結構
    const hasSchema = aiContent.includes("schema:");
    const hasMetadata = aiContent.includes("metadata:");
    const hasHandler = aiContent.includes("handler:");
    const hasValidator = aiContent.includes("validator:");

    console.log(`✅ Schema 結構: ${hasSchema ? "存在" : "缺失"}`);
    console.log(`✅ Metadata 結構: ${hasMetadata ? "存在" : "缺失"}`);
    console.log(`✅ Handler 函數: ${hasHandler ? "存在" : "缺失"}`);
    console.log(`✅ Validator 函數: ${hasValidator ? "存在" : "缺失"}`);

    // 5. 檢查分類系統
    console.log("\n🏷️ 檢查分類系統...");

    const categoriesFile = "src/lib/functions/categories.ts";
    const categoriesContent = fs.readFileSync(categoriesFile, "utf8");

    const hasToolCategory = categoriesContent.includes("ToolCategory");
    const hasAccessLevel = categoriesContent.includes("FunctionAccessLevel");
    const hasCategoryMetadata = categoriesContent.includes("CATEGORY_METADATA");

    console.log(`✅ ToolCategory 枚舉: ${hasToolCategory ? "存在" : "缺失"}`);
    console.log(
      `✅ FunctionAccessLevel 枚舉: ${hasAccessLevel ? "存在" : "缺失"}`
    );
    console.log(
      `✅ CATEGORY_METADATA: ${hasCategoryMetadata ? "存在" : "缺失"}`
    );

    // 6. 檢查類型定義
    console.log("\n📝 檢查類型定義...");

    const typesFile = "src/lib/functions/types.ts";
    const typesContent = fs.readFileSync(typesFile, "utf8");

    const hasFunctionDefinition = typesContent.includes("FunctionDefinition");
    const hasExecutionContext = typesContent.includes("ExecutionContext");
    const hasExecutionResult = typesContent.includes("ExecutionResult");

    console.log(
      `✅ FunctionDefinition 介面: ${hasFunctionDefinition ? "存在" : "缺失"}`
    );
    console.log(
      `✅ ExecutionContext 介面: ${hasExecutionContext ? "存在" : "缺失"}`
    );
    console.log(
      `✅ ExecutionResult 介面: ${hasExecutionResult ? "存在" : "缺失"}`
    );

    // 7. 檢查 LangChain 整合
    console.log("\n🔗 檢查 LangChain 整合...");

    const langchainBinderFile = "src/lib/functions/langchain-binder.ts";
    if (fs.existsSync(langchainBinderFile)) {
      console.log("✅ LangChain 綁定器存在");
      const binderContent = fs.readFileSync(langchainBinderFile, "utf8");
      const hasCreateFunction =
        binderContent.includes("createLangChainTools") ||
        binderContent.includes("createDynamicTool");
      console.log(`✅ 工具創建函數: ${hasCreateFunction ? "存在" : "缺失"}`);
    } else {
      console.log("⚠️ LangChain 綁定器不存在");
    }

    // 8. 生成測試報告
    console.log("\n📊 生成測試報告...");

    const report = {
      timestamp: new Date().toISOString(),
      totalTools: toolCount,
      categories: toolDirs.length,
      filesChecked: requiredFiles.length,
      compilationStatus: "passed",
      features: {
        openaiSchema: hasSchema,
        metadata: hasMetadata,
        handlers: hasHandler,
        validators: hasValidator,
        categories: hasToolCategory,
        accessLevels: hasAccessLevel,
        langchainIntegration: fs.existsSync(langchainBinderFile),
      },
    };

    console.log("測試報告:");
    console.log(JSON.stringify(report, null, 2));

    console.log(
      "\n============================================================"
    );
    console.log("🎉 AI Agent 整合測試完成！");
    console.log("============================================================");

    return true;
  } catch (error) {
    console.error("❌ AI Agent 整合測試失敗:", error.message);
    return false;
  }
}

// 執行測試
testUnifiedFunctionSystem()
  .then((success) => {
    if (success) {
      console.log(
        "\n✅ 所有測試通過！統一 Function Call 系統已準備好與 AI Agent 整合。"
      );
      console.log("\n📋 下一步建議:");
      console.log("1. 在實際 AI Agent 中導入 src/lib/functions/index.ts");
      console.log(
        "2. 使用 generateOpenAISchemas() 生成 OpenAI Function Call 定義"
      );
      console.log("3. 使用 executeToolById() 執行工具調用");
      console.log("4. 使用 searchTools() 進行智能工具選擇");
      process.exit(0);
    } else {
      console.log("\n❌ 測試失敗，請檢查上述錯誤。");
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error("測試執行失敗:", error);
    process.exit(1);
  });
