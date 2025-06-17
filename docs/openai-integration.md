# 🚀 OpenAI Function Calling 整合快速指南

## 📋 概述

這是一個完整的 **Node.js + gpt-4o function calling** 整合方案，讓 AI 能夠：

1. **自動調用工具** - AI 根據需求主動選擇和執行工具
2. **安全執行操作** - 內建路徑檢查、命令白名單、用戶確認機制
3. **智能代碼編輯** - 使用 unified diff 進行精確的代碼修改
4. **完整會話管理** - 支援多會話、工具調用統計、會話導入導出

---

## ⚡ 快速開始

### 1. 安裝依賴

```bash
npm install openai diff jsdiff diff-match-patch
npm install -D @types/diff @types/node
```

### 2. 設置環境變數

```bash
export OPENAI_API_KEY="your-openai-api-key"
```

### 3. 基本使用

```typescript
import { createOpenAIIntegration } from "./src/lib/openai-integration";

// 創建配置
const config = {
  openaiApiKey: process.env.OPENAI_API_KEY!,
  model: "gpt-4o",
  aiEditorConfig: {
    projectPath: "/path/to/your/project",
    projectContext: {
      projectId: "my-project",
      projectName: "My Next.js App",
      containerStatus: "running",
    },
    enableAdvancedTools: true,
    enableUserConfirmation: true,
  },
  enableToolCallLogging: true,
};

// 創建整合實例
const ai = createOpenAIIntegration(config);

// 創建會話
const sessionId = ai.createSession();

// 發送訊息，AI 會自動調用需要的工具
const result = await ai.sendMessage(
  sessionId,
  "請幫我分析專案結構，然後修改 Button 組件添加 loading 狀態"
);

console.log("AI 回應:", result.response);
console.log("執行了", result.toolCallsExecuted, "個工具");
```

---

## 🔧 可用工具清單

### 📁 檔案操作

- `read_file` - 讀取檔案內容
- `list_files` - 列出檔案清單（支援 glob 過濾）
- `search_code` - 搜尋代碼關鍵字

### ✏️ 代碼編輯

- `propose_diff` - 生成 unified diff 修改建議
- `summarize_file` - 生成檔案摘要

### 🚀 執行操作

- `run_command` - 執行終端指令（白名單限制）
- `test_file` - 執行測試檔案

### 📊 專案分析

- `get_project_context` - 獲取專案結構
- `get_git_diff` - 獲取 Git 變更
- `get_terminal_output` - 獲取終端輸出

### 💬 用戶互動

- `ask_user` - 與用戶確認操作

---

## 🎯 使用場景範例

### 場景 1：代碼重構

```typescript
const result = await ai.sendMessage(
  sessionId,
  `
請幫我重構 src/components/Button.tsx：
1. 添加 loading 狀態支持
2. 添加 size 屬性（small, medium, large）
3. 改善 TypeScript 類型定義
4. 執行相關測試確保沒有破壞功能
`
);
```

**AI 會自動執行：**

- 讀取 Button.tsx 檔案
- 分析現有代碼結構
- 生成 unified diff 修改建議
- 詢問用戶確認修改
- 執行相關測試
- 檢查 Git 狀態

### 場景 2：專案分析

```typescript
const result = await ai.sendMessage(
  sessionId,
  `
請分析這個 Next.js 專案：
1. 列出所有 React 組件
2. 找出可能的性能問題
3. 檢查是否有未使用的依賴
4. 生成專案結構報告
`
);
```

### 場景 3：測試和部署

```typescript
const result = await ai.sendMessage(
  sessionId,
  `
請幫我準備部署：
1. 執行所有測試
2. 檢查 TypeScript 類型錯誤
3. 運行 linter
4. 檢查 Git 狀態
5. 如果一切正常，協助我創建 production build
`
);
```

---

## 🔒 安全機制

### 路徑安全

- 自動阻止存取 `../`, `/etc/`, `C:\` 等危險路徑
- 限制在專案根目錄以下操作

### 命令白名單

```typescript
const safeCommands = [
  "npm install",
  "npm test",
  "npm run",
  "yarn install",
  "yarn test",
  "yarn build",
  "git status",
  "git diff",
  "git log",
  "ls",
  "pwd",
  "cat",
];
```

### 用戶確認

- 重要操作（檔案修改、危險命令）需要用戶確認
- 支援批量確認和個別確認

---

## 📊 監控和統計

### 工具調用統計

```typescript
const stats = ai.getToolCallStats(sessionId);
console.log("統計資料:", {
  totalCalls: stats.totalCalls,
  successRate: stats.successfulCalls / stats.totalCalls,
  averageTime: stats.averageExecutionTime,
  mostUsedTool: Object.keys(stats.toolUsage)[0],
});
```

### 會話管理

```typescript
// 獲取所有會話
const sessions = ai.getAllSessions();

// 導出會話
const sessionData = ai.exportSession(sessionId);

// 導入會話
const newSessionId = ai.importSession(sessionData);
```

---

## 🎨 進階功能

### 多專門化會話

```typescript
const frontendExpert = ai.createSession("你是前端開發專家");
const backendExpert = ai.createSession("你是後端開發專家");
const testExpert = ai.createSession("你是測試專家");

// 在不同會話中處理不同類型的任務
await ai.sendMessage(frontendExpert, "優化 React 組件性能");
await ai.sendMessage(backendExpert, "檢查 API 路由安全性");
await ai.sendMessage(testExpert, "增加測試覆蓋率");
```

### 工具調用可視化

```typescript
// 啟用詳細日誌
const config = {
  // ... 其他配置
  enableToolCallLogging: true,
};

// 每次工具調用都會顯示：
// 🔧 執行工具: read_file {"path": "src/App.tsx"}
// ✅ 工具執行完成: read_file (45ms)
```

### 自定義工具

```typescript
// 可以擴展工具註冊表
const customTools = {
  deploy_to_vercel: async (args) => {
    // 自定義部署邏輯
  },
  run_lighthouse_audit: async (args) => {
    // 自定義性能測試
  },
};
```

---

## 🚨 常見問題

### Q: AI 沒有調用工具怎麼辦？

A: 確保：

1. 訊息明確描述需要執行的操作
2. 工具描述清楚且相關
3. 使用 `tool_choice: "auto"` 或指定特定工具

### Q: 工具執行失敗怎麼辦？

A: 檢查：

1. 檔案路徑是否正確
2. 權限是否足夠
3. 命令是否在白名單中
4. 查看詳細錯誤日誌

### Q: 如何添加新工具？

A:

1. 在 `ai-function-schemas.ts` 中定義 schema
2. 在 `ai-editor-tools.ts` 中實作功能
3. 在 `ai-editor-manager.ts` 中註冊工具

---

## 📚 完整範例

查看 `src/lib/openai-integration-example.ts` 獲取：

- 基本使用範例
- 代碼修改流程
- 工具調用可視化
- 會話管理
- 安全性確認
- 完整工作流程

```bash
# 執行所有範例
npm run example:openai-integration
```

---

## 🎉 總結

這個整合方案提供了：

✅ **完整的 gpt-4o function calling 支援**  
✅ **安全的代碼編輯環境**  
✅ **智能工具選擇和執行**  
✅ **詳細的操作日誌和統計**  
✅ **靈活的會話管理**  
✅ **可擴展的工具系統**

現在你可以讓 AI 真正成為你的編程助手，自動執行複雜的開發任務！
