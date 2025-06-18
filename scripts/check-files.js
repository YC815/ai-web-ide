#!/usr/bin/env node

console.log("🧪 測試統一 Function Call 系統的基本功能...");
console.log("");

// 檢查文件是否存在
const fs = require("fs");
const path = require("path");

const files = [
  "src/lib/functions/types.ts",
  "src/lib/functions/categories.ts",
  "src/lib/functions/index.ts",
  "src/lib/functions/registry.ts",
  "src/lib/functions/executor.ts",
];

console.log("📁 檢查核心文件存在性:");
files.forEach((file) => {
  const exists = fs.existsSync(file);
  console.log("  " + (exists ? "✅" : "❌") + " " + file);
});

console.log("");
console.log("📂 檢查工具模組目錄:");
const dirs = [
  "src/lib/functions/ai",
  "src/lib/functions/docker",
  "src/lib/functions/filesystem",
  "src/lib/functions/network",
  "src/lib/functions/project",
  "src/lib/functions/system",
  "src/lib/functions/utility",
];

dirs.forEach((dir) => {
  const exists = fs.existsSync(dir);
  const indexExists = fs.existsSync(path.join(dir, "index.ts"));
  console.log(
    "  " +
      (exists ? "✅" : "❌") +
      " " +
      dir +
      (indexExists ? " (有 index.ts)" : " (缺少 index.ts)")
  );
});

console.log("");
console.log("✅ 文件檢查完成！");

// 嘗試編譯檢查
console.log("");
console.log("🔧 檢查 TypeScript 編譯狀態...");
const { execSync } = require("child_process");

try {
  execSync("npx tsc --noEmit --skipLibCheck src/lib/functions/types.ts", {
    stdio: "pipe",
  });
  console.log("✅ types.ts 編譯正常");
} catch (error) {
  console.log("❌ types.ts 編譯失敗:", error.message);
}

try {
  execSync("npx tsc --noEmit --skipLibCheck src/lib/functions/categories.ts", {
    stdio: "pipe",
  });
  console.log("✅ categories.ts 編譯正常");
} catch (error) {
  console.log("❌ categories.ts 編譯失敗:", error.message);
}
