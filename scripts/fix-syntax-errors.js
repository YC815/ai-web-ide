#!/usr/bin/env node

const fs = require("fs");

console.log("🔧 修復語法錯誤...\n");

// 需要修復的文件
const files = [
  "src/lib/functions/ai/index.ts",
  "src/lib/functions/project/index.ts",
  "src/lib/functions/system/index.ts",
];

files.forEach((file) => {
  if (!fs.existsSync(file)) {
    console.log(`⚠️ 文件不存在: ${file}`);
    return;
  }

  let content = fs.readFileSync(file, "utf8");

  // 修復 rateLimit 語法錯誤
  content = content.replace(
    /rateLimited: true, maxCallsPerMinute: 30, \/\/ rateLimit: \{[^}]*\}/g,
    "rateLimited: true,\n    maxCallsPerMinute: 30"
  );

  // 修復可能的其他語法問題
  content = content.replace(
    /rateLimited: true, maxCallsPerMinute: 30, \/\/ rateLimit:/g,
    "rateLimited: true,\n    maxCallsPerMinute: 30"
  );

  fs.writeFileSync(file, content);
  console.log(`✅ 修復文件: ${file}`);
});

console.log("\n✅ 語法錯誤修復完成！");
