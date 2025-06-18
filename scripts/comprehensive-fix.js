#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

console.log("🔧 綜合修復統一 Function Call 系統...\n");

// 修復各個工具模組
const toolModules = [
  "src/lib/functions/filesystem/index.ts",
  "src/lib/functions/network/index.ts",
  "src/lib/functions/utility/index.ts",
];

// 修復導入問題
toolModules.forEach((file) => {
  if (!fs.existsSync(file)) {
    console.log(`⚠️ 文件不存在: ${file}`);
    return;
  }

  let content = fs.readFileSync(file, "utf8");

  // 修復導入
  content = content.replace(
    /import \{\s*FunctionDefinition,\s*FunctionCategory,\s*FunctionAccessLevel,\s*OpenAIFunctionSchema\s*\} from '\.\.\/categories';/g,
    `import { 
  FunctionDefinition, 
  ToolCategory, 
  FunctionAccessLevel 
} from '../types';
import type { OpenAIFunctionSchema } from '../categories';`
  );

  fs.writeFileSync(file, content);
  console.log(`✅ 修復導入: ${file}`);
});

// 修復分類問題 - 將所有不存在的分類改為對應的基本分類
const categoryMappings = {
  "ToolCategory.WORKSPACE": "ToolCategory.PROJECT",
  "ToolCategory.CODE": "ToolCategory.PROJECT",
  "ToolCategory.DEVELOPMENT": "ToolCategory.PROJECT",
  "ToolCategory.MONITORING": "ToolCategory.SYSTEM",
  "ToolCategory.LOGGING": "ToolCategory.SYSTEM",
  "ToolCategory.DEBUG": "ToolCategory.SYSTEM",
  "ToolCategory.SECURITY": "ToolCategory.SYSTEM",
};

const allFiles = [
  "src/lib/functions/project/index.ts",
  "src/lib/functions/system/index.ts",
];

allFiles.forEach((file) => {
  if (!fs.existsSync(file)) {
    console.log(`⚠️ 文件不存在: ${file}`);
    return;
  }

  let content = fs.readFileSync(file, "utf8");

  // 替換分類
  Object.entries(categoryMappings).forEach(([from, to]) => {
    content = content.replace(new RegExp(from.replace(/\./g, "\\."), "g"), to);
  });

  fs.writeFileSync(file, content);
  console.log(`✅ 修復分類: ${file}`);
});

console.log("\n🔧 修復 FunctionDefinition 結構...\n");

// 修復所有工具文件的結構 - 將 parameters 移到 schema 中
const allToolFiles = [
  "src/lib/functions/ai/index.ts",
  "src/lib/functions/project/index.ts",
  "src/lib/functions/system/index.ts",
];

allToolFiles.forEach((file) => {
  if (!fs.existsSync(file)) {
    console.log(`⚠️ 文件不存在: ${file}`);
    return;
  }

  let content = fs.readFileSync(file, "utf8");

  // 修復 FunctionDefinition 結構
  // 將 name, description, parameters 包裝到 schema 中
  content = content.replace(
    /(export const \w+: FunctionDefinition = \{)\s*name: '([^']+)',\s*description: '([^']+)',\s*parameters: (\{[\s\S]*?\}),\s*metadata:/g,
    `$1
  id: '$2',
  schema: {
    name: '$2',
    description: '$3',
    parameters: $4
  },
  metadata:`
  );

  fs.writeFileSync(file, content);
  console.log(`✅ 修復結構: ${file}`);
});

console.log("\n✅ 綜合修復完成！");
