/**
 * 靜默日誌過濾器 - 攔截 Node.js 底層輸出流
 * 用於過濾 Next.js 內建的請求日誌
 */

// 保存原始的 stdout.write 方法
const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;

// 需要過濾的日誌模式
const FILTERED_PATTERNS = [
  /GET \/api\/docker-status.*200 in \d+ms/,
  /POST \/api\/docker-status.*200 in \d+ms/,
  /GET \/api\/docker-containers.*200 in \d+ms/,
];

// 檢查是否應該過濾此輸出
function shouldFilter(message) {
  return FILTERED_PATTERNS.some((pattern) => pattern.test(message));
}

// 覆蓋 stdout.write
process.stdout.write = function (chunk, encoding, callback) {
  const message = chunk.toString();

  if (shouldFilter(message)) {
    // 靜默處理 - 不輸出
    if (typeof encoding === "function") {
      encoding(); // callback
    } else if (typeof callback === "function") {
      callback();
    }
    return true;
  }

  // 使用原始方法輸出其他內容
  return originalStdoutWrite.call(this, chunk, encoding, callback);
};

// 覆蓋 stderr.write（以防萬一）
process.stderr.write = function (chunk, encoding, callback) {
  const message = chunk.toString();

  if (shouldFilter(message)) {
    // 靜默處理 - 不輸出
    if (typeof encoding === "function") {
      encoding(); // callback
    } else if (typeof callback === "function") {
      callback();
    }
    return true;
  }

  // 使用原始方法輸出其他內容
  return originalStderrWrite.call(this, chunk, encoding, callback);
};

console.log("🔇 Docker API 日誌過濾器已啟動");
