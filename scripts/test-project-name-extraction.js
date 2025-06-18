function extractProjectNameFromContainer(containerName) {
  // 匹配 ai-web-ide-{project-name}-{timestamp} 格式
  const match = containerName.match(/^ai-web-ide-(.+?)-\d+$/);
  if (match) {
    return match[1].replace(/-/g, "_"); // 將短橫線轉換為底線
  }
  return null;
}

const containerName = "ai-web-ide-new-testing-1750210123230";
const extracted = extractProjectNameFromContainer(containerName);

console.log("容器名稱:", containerName);
console.log("提取的專案名稱:", extracted);
console.log("預期的目錄路徑:", `/app/workspace/${extracted}`);

// 驗證實際的目錄名稱
console.log("\n實際容器內目錄: new_testing");
console.log(
  "提取結果是否正確:",
  extracted === "new_testing" ? "✅ 正確" : "❌ 錯誤"
);
