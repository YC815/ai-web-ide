#!/usr/bin/env node

const fs = require("fs");

console.log("🔧 修復 AI 工具分類...\n");

const file = "src/lib/functions/ai/index.ts";

if (!fs.existsSync(file)) {
  console.log(`⚠️ 文件不存在: ${file}`);
  process.exit(1);
}

let content = fs.readFileSync(file, "utf8");

// 修復 AI 工具分類
content = content.replace(/ToolCategory\.AI_AGENT/g, "ToolCategory.AI");
content = content.replace(/ToolCategory\.AI_CHAT/g, "ToolCategory.AI");
content = content.replace(/ToolCategory\.AI_TOOLS/g, "ToolCategory.AI");

fs.writeFileSync(file, content);
console.log(`✅ 修復文件: ${file}`);
console.log("\n✅ AI 工具分類修復完成！");
