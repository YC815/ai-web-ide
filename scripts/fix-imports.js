#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

console.log("🔧 修復統一 Function Call 系統的導入問題...\n");

// 需要修復的文件和替換規則
const fixRules = [
  {
    file: "src/lib/functions/docker/index.ts",
    replacements: [
      {
        from: "FunctionCategory.DOCKER",
        to: "ToolCategory.DOCKER",
      },
      {
        from: "import { UnifiedDockerTools, DockerToolsMode, showMigrationWarning } from '../../ai/tools/docker-tools-unified';",
        to: "// import { UnifiedDockerTools, DockerToolsMode, showMigrationWarning } from '../../ai/tools/docker-tools-unified';",
      },
    ],
  },
  {
    file: "src/lib/functions/filesystem/index.ts",
    replacements: [
      {
        from: "FunctionCategory.FILESYSTEM",
        to: "ToolCategory.FILESYSTEM",
      },
    ],
  },
  {
    file: "src/lib/functions/network/index.ts",
    replacements: [
      {
        from: "FunctionCategory.NETWORK",
        to: "ToolCategory.NETWORK",
      },
    ],
  },
  {
    file: "src/lib/functions/utility/index.ts",
    replacements: [
      {
        from: "FunctionCategory.UTILITY",
        to: "ToolCategory.UTILITY",
      },
    ],
  },
  {
    file: "src/lib/functions/ai/index.ts",
    replacements: [
      {
        from: "rateLimit:",
        to: "rateLimited: true, maxCallsPerMinute: 30, // rateLimit:",
      },
    ],
  },
  {
    file: "src/lib/functions/project/index.ts",
    replacements: [
      {
        from: "rateLimit:",
        to: "rateLimited: true, maxCallsPerMinute: 30, // rateLimit:",
      },
    ],
  },
  {
    file: "src/lib/functions/system/index.ts",
    replacements: [
      {
        from: "rateLimit:",
        to: "rateLimited: true, maxCallsPerMinute: 30, // rateLimit:",
      },
    ],
  },
];

// 執行修復
let totalFixed = 0;

fixRules.forEach((rule) => {
  const filePath = rule.file;

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ 文件不存在: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, "utf8");
  let fileFixed = 0;

  rule.replacements.forEach((replacement) => {
    const beforeCount = (
      content.match(
        new RegExp(replacement.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")
      ) || []
    ).length;
    content = content.replace(
      new RegExp(replacement.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      replacement.to
    );
    const afterCount = (
      content.match(
        new RegExp(replacement.to.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")
      ) || []
    ).length;

    if (beforeCount > 0) {
      fileFixed += beforeCount;
      console.log(
        `  ✅ 替換 "${replacement.from}" -> "${replacement.to}" (${beforeCount} 次)`
      );
    }
  });

  if (fileFixed > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ 修復文件: ${filePath} (${fileFixed} 個修復)`);
    totalFixed += fileFixed;
  } else {
    console.log(`ℹ️ 文件無需修復: ${filePath}`);
  }

  console.log("");
});

console.log(`🎉 修復完成！總共修復了 ${totalFixed} 個問題。`);

// 檢查是否還有其他問題
console.log("\n🔍 檢查是否還有其他導入問題...");

const checkFiles = [
  "src/lib/functions/index.ts",
  "src/lib/functions/types.ts",
  "src/lib/functions/categories.ts",
];

checkFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file} 存在`);
  } else {
    console.log(`❌ ${file} 不存在`);
  }
});

console.log("\n✅ 導入問題修復完成！");
