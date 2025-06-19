# 🤖 AI 工具正確使用指南

## 🚨 重要：參數名稱規範

**本指南解決 AI 調用工具時參數名稱錯誤的問題**

### ❌ 常見錯誤

AI 經常使用錯誤的參數名稱調用工具：

```json
// ❌ 錯誤：使用 input 參數
{"input": "src/app/page.tsx"}

// ❌ 錯誤：使用 directoryPath 參數
{"directoryPath": "src"}
```

### ✅ 正確用法

## 1. 📖 docker_read_file - 讀取檔案

**正確參數名稱：`filePath`**

```json
// ✅ 正確格式
{
  "filePath": "src/app/page.tsx"
}

// ✅ 其他範例
{
  "filePath": "package.json"
}
{
  "filePath": "src/components/Button.tsx"
}
```

**錯誤格式（絕對不要使用）：**

```json
// ❌ 錯誤：不是 input
{"input": "src/app/page.tsx"}

// ❌ 錯誤：不是 path
{"path": "src/app/page.tsx"}

// ❌ 錯誤：不是 file
{"file": "src/app/page.tsx"}
```

## 2. 📁 docker_ls - 列出目錄

**正確參數名稱：`path`**

```json
// ✅ 正確格式
{
  "path": "src"
}

// ✅ 查看根目錄
{
  "path": "."
}

// ✅ 使用選項
{
  "path": "src/app",
  "long": true,
  "all": false
}
```

**錯誤格式（絕對不要使用）：**

```json
// ❌ 錯誤：不是 input
{"input": "src"}

// ❌ 錯誤：不是 directoryPath
{"directoryPath": "src"}

// ❌ 錯誤：不是 dir
{"dir": "src"}
```

## 3. 🌳 docker_tree - 樹狀結構

**正確參數名稱：`path`**

```json
// ✅ 正確格式
{
  "path": "src"
}

// ✅ 限制深度
{
  "path": ".",
  "depth": 3
}

// ✅ 顯示所有檔案
{
  "path": "src/components",
  "all": true
}
```

**錯誤格式（絕對不要使用）：**

```json
// ❌ 錯誤：不是 input
{"input": "src"}

// ❌ 錯誤：不是 directoryPath
{"directoryPath": "src"}

// ❌ 錯誤：不是 dirPath
{"dirPath": "src"}
```

## 📋 工具參數對照表

| 工具名稱           | 正確參數名稱 | ❌ 常見錯誤                         | 用途         |
| ------------------ | ------------ | ----------------------------------- | ------------ |
| `docker_read_file` | `filePath`   | `input`, `path`, `file`             | 讀取檔案內容 |
| `docker_ls`        | `path`       | `input`, `directoryPath`, `dir`     | 列出目錄內容 |
| `docker_tree`      | `path`       | `input`, `directoryPath`, `dirPath` | 顯示樹狀結構 |

## 🎯 路徑格式規範

### ✅ 正確路徑格式

```
src/app/page.tsx          ← 相對路徑
package.json              ← 根目錄檔案
src/components/Button.tsx ← 組件檔案
.                         ← 當前目錄
src                       ← 源碼目錄
```

### ❌ 錯誤路徑格式

```
/app/workspace/project/src/app/page.tsx  ← 絕對路徑
./src/app/page.tsx                       ← ./ 開頭
../other-project/file.tsx                ← ../ 路徑遍歷
```

## 🔧 完整調用範例

### 查看主頁檔案

```javascript
// ✅ 正確方式
await callTool("docker_read_file", {
  filePath: "src/app/page.tsx",
});
```

### 列出 src 目錄

```javascript
// ✅ 正確方式
await callTool("docker_ls", {
  path: "src",
});
```

### 查看專案結構

```javascript
// ✅ 正確方式
await callTool("docker_tree", {
  path: ".",
  depth: 3,
});
```

## 🚨 參數驗證錯誤處理

如果 AI 收到以下錯誤訊息：

### 錯誤：參數驗證失敗

```
❌ 參數名稱錯誤！應該使用 "filePath" 而不是 "input"
```

**解決方案：**

1. 檢查工具名稱和對應的正確參數名稱
2. 使用本指南的正確格式重新調用
3. 確保參數值使用相對路徑

### 錯誤：檔案不存在

```
Error: 檔案不存在 或 目錄不存在
```

**解決方案：**

1. 先使用 `docker_ls` 查看目錄結構
2. 確認檔案路徑拼寫正確
3. 使用 `docker_tree` 了解整體專案結構

## 🎯 最佳實踐

1. **總是使用正確的參數名稱**

   - `docker_read_file` → `filePath`
   - `docker_ls` → `path`
   - `docker_tree` → `path`

2. **路徑格式一致性**

   - 使用相對路徑
   - 避免絕對路徑和路徑遍歷

3. **錯誤恢復策略**

   - 參數錯誤時立即修正重試
   - 檔案不存在時先探索目錄結構
   - 使用工具鏈：tree → ls → read_file

4. **效率最佳化**
   - 優先使用 `docker_tree` 了解整體結構
   - 使用 `docker_ls` 精確定位檔案
   - 最後使用 `docker_read_file` 讀取內容

## 📖 常見場景處理

### 場景 1：用戶要求查看主頁

```javascript
// 1. 先確認專案結構
await callTool("docker_tree", { path: "." });

// 2. 讀取主頁檔案
await callTool("docker_read_file", { filePath: "src/app/page.tsx" });
```

### 場景 2：用戶詢問專案有哪些檔案

```javascript
// 1. 查看根目錄
await callTool("docker_ls", { path: "." });

// 2. 查看 src 目錄
await callTool("docker_ls", { path: "src" });

// 3. 顯示樹狀結構
await callTool("docker_tree", { path: ".", depth: 3 });
```

### 場景 3：檔案不存在時的處理

```javascript
// 1. 嘗試讀取檔案
try {
  await callTool("docker_read_file", { filePath: "src/app/page.tsx" });
} catch (error) {
  // 2. 檔案不存在，先探索結構
  await callTool("docker_tree", { path: "src" });

  // 3. 查看 app 目錄
  await callTool("docker_ls", { path: "src/app" });
}
```

---

**記住：正確的參數名稱是工具成功執行的關鍵！**
