# AI 編輯器工具 - 基於 Diff 驅動的安全 AI 編輯器

這是一套完整的 AI 編輯器工具，實現了基於 diff 驅動、具安全限制的 AI 編輯功能，類似於自製的 Cursor 編輯器。

## 🎯 功能特色

- ✅ **給 AI 使用的標準化工具** - 符合 gpt-4o function calling 格式
- 🔧 **系統內部執行工具** - 安全的檔案操作和命令執行
- 🛡️ **安全限制機制** - 路徑檢查、命令白名單、用戶確認
- 📊 **操作日誌系統** - 完整記錄所有 AI 操作
- 🔄 **專業 Diff 處理** - 使用 `diff` 庫進行精確的代碼變更

## 📁 檔案結構

```
src/lib/
├── ai-editor-tools.ts      # 給 AI 使用的前端工具
├── ai-system-tools.ts      # 系統內部執行工具
├── ai-function-schemas.ts  # gpt-4o function calling schema
├── ai-editor-manager.ts    # 統一管理器
├── diff-processor.ts       # 專業 diff 處理工具
└── ai-editor-example.ts    # 使用範例
```

## 🚀 快速開始

### 1. 基本使用

```typescript
import { createAIEditorManager, AIEditorConfig } from "./lib/ai-editor-manager";

// 創建配置
const config: AIEditorConfig = {
  projectPath: "/path/to/your/project",
  projectContext: {
    projectId: "my-project-123",
    projectName: "My Next.js App",
    containerStatus: "running",
  },
  enableAdvancedTools: true,
  enableUserConfirmation: true,
  enableActionLogging: true,
};

// 創建 AI 編輯器
const aiEditor = createAIEditorManager(config);

// 讀取檔案
const fileContent = await aiEditor.executeAITool("read_file", {
  path: "src/components/Button.tsx",
});

console.log(fileContent.data);
```

### 2. 與 OpenAI API 整合

```typescript
// 獲取 function 定義
const functionDefinitions = aiEditor.getFunctionDefinitionsForOpenAI();

// 在 OpenAI API 請求中使用
const openAIRequest = {
  model: "gpt-4o",
  messages: [
    {
      role: "system",
      content: "你是一個 AI 編程助手，可以使用提供的工具來編輯代碼。",
    },
    {
      role: "user",
      content: "請幫我在 Button 組件中添加 loading 狀態",
    },
  ],
  functions: functionDefinitions,
  function_call: "auto",
};

// 處理 AI 回應
if (response.function_call) {
  const result = await aiEditor.executeAITool(
    response.function_call.name,
    JSON.parse(response.function_call.arguments)
  );
}
```

## 🛠️ 可用工具

### 核心工具 (MVP 必備)

| 工具名稱       | 功能         | 參數                                                      |
| -------------- | ------------ | --------------------------------------------------------- |
| `read_file`    | 讀取檔案內容 | `{ path: string }`                                        |
| `list_files`   | 列出檔案清單 | `{ dir?: string, glob?: string }`                         |
| `ask_user`     | 與用戶互動   | `{ prompt: string, options?: string[] }`                  |
| `propose_diff` | 提議代碼修改 | `{ path: string, original: string, instruction: string }` |
| `run_command`  | 執行終端指令 | `{ cmd: string }`                                         |
| `search_code`  | 搜尋代碼     | `{ keyword: string }`                                     |

### 進階工具

| 工具名稱              | 功能          | 參數               |
| --------------------- | ------------- | ------------------ |
| `get_project_context` | 獲取專案結構  | `{}`               |
| `get_git_diff`        | 獲取 Git 差異 | `{}`               |
| `get_terminal_output` | 獲取終端輸出  | `{}`               |
| `test_file`           | 執行測試檔案  | `{ path: string }` |
| `summarize_file`      | 生成檔案摘要  | `{ path: string }` |

## 🔒 安全機制

### 路徑安全檢查

```typescript
// 危險路徑會被阻止
const unsafePaths = [
  "../../../etc/passwd", // ❌ 被阻止
  "/etc/hosts", // ❌ 被阻止
  "C:\\Windows\\System32", // ❌ 被阻止
];

// 安全路徑允許存取
const safePaths = [
  "src/components/Button.tsx", // ✅ 允許
  "package.json", // ✅ 允許
  "README.md", // ✅ 允許
];
```

### 命令白名單

```typescript
// 安全命令
const safeCommands = [
  "npm install", // ✅ 允許
  "npm run build", // ✅ 允許
  "git status", // ✅ 允許
  "ls -la", // ✅ 允許
];

// 危險命令會被阻止
const dangerousCommands = [
  "rm -rf /", // ❌ 被阻止
  "sudo rm", // ❌ 被阻止
  "chmod 777", // ❌ 被阻止
];
```

### 用戶確認機制

```typescript
// 啟用用戶確認
const config = {
  enableUserConfirmation: true,
};

// 危險操作會要求用戶確認
const result = await aiEditor.executeAITool("propose_diff", {
  path: "src/important-file.ts",
  original: originalContent,
  instruction: "重構整個檔案",
});

if (result.requiresConfirmation) {
  // 等待用戶確認
  await aiEditor.handleUserConfirmation(actionId, true); // 確認
  // 或
  await aiEditor.handleUserConfirmation(actionId, false); // 取消
}
```

## 📊 監控和日誌

### 操作日誌

```typescript
// 獲取操作日誌
const logs = aiEditor.getActionLogs(10);

logs.forEach((log) => {
  console.log(`${log.timestamp}: ${log.action} - ${log.result}`);
});
```

### 待處理操作

```typescript
// 獲取待處理的操作
const pendingActions = aiEditor.getPendingActions();

pendingActions.forEach((action) => {
  console.log(`待處理: ${action.toolName} - ${action.status}`);
});
```

## 🔄 Diff 處理

### 生成 Unified Diff

```typescript
import DiffProcessor from "./lib/diff-processor";

const original = "Hello World";
const modified = "Hello AI World";

const diff = DiffProcessor.generateUnifiedDiff(
  original,
  modified,
  "greeting.txt"
);

console.log(diff);
// --- greeting.txt
// +++ greeting.txt
// @@ -1 +1 @@
// -Hello World
// +Hello AI World
```

### 套用 Diff

```typescript
const result = DiffProcessor.applyUnifiedDiff(original, diff);
console.log(result); // "Hello AI World"
```

### Diff 統計

```typescript
const stats = DiffProcessor.calculateDiffStats(diff);
console.log(stats);
// { additions: 1, deletions: 1, changes: 2 }
```

## 🎨 前端整合

### React 組件範例

```tsx
import React, { useState } from "react";
import { createAIEditorManager } from "./lib/ai-editor-manager";

function AIEditorComponent() {
  const [aiEditor] = useState(() => createAIEditorManager(config));
  const [pendingActions, setPendingActions] = useState([]);

  const handleUserConfirmation = async (
    actionId: string,
    confirmed: boolean
  ) => {
    await aiEditor.handleUserConfirmation(actionId, confirmed);
    setPendingActions(aiEditor.getPendingActions());
  };

  return (
    <div>
      {pendingActions.map((action) => (
        <ConfirmationDialog
          key={action.id}
          action={action}
          onConfirm={() => handleUserConfirmation(action.id, true)}
          onCancel={() => handleUserConfirmation(action.id, false)}
        />
      ))}
    </div>
  );
}
```

## 📝 完整工作流程範例

```typescript
async function completeWorkflow() {
  const aiEditor = createAIEditorManager(config);

  // 1. 獲取專案概覽
  const projectContext = await aiEditor.executeAITool(
    "get_project_context",
    {}
  );

  // 2. 搜尋組件
  const searchResults = await aiEditor.executeAITool("search_code", {
    keyword: "Button",
  });

  // 3. 讀取檔案
  const fileContent = await aiEditor.executeAITool("read_file", {
    path: "src/components/Button.tsx",
  });

  // 4. 提議修改
  const diffProposal = await aiEditor.executeAITool("propose_diff", {
    path: "src/components/Button.tsx",
    original: fileContent.data,
    instruction: "添加 loading 狀態支持",
  });

  // 5. 執行測試
  const testResult = await aiEditor.executeAITool("test_file", {
    path: "src/components/Button.test.tsx",
  });

  // 6. 檢查 Git 狀態
  const gitDiff = await aiEditor.executeAITool("get_git_diff", {});
}
```

## 🔧 配置選項

```typescript
interface AIEditorConfig {
  projectPath: string; // 專案路徑
  projectContext: ProjectContext; // 專案上下文
  enableAdvancedTools?: boolean; // 啟用進階工具
  enableUserConfirmation?: boolean; // 啟用用戶確認
  enableActionLogging?: boolean; // 啟用操作日誌
}
```

## 📦 依賴包

```json
{
  "dependencies": {
    "diff": "^5.1.0",
    "jsdiff": "^1.1.1",
    "diff-match-patch": "^1.0.5"
  },
  "devDependencies": {
    "@types/diff": "^5.0.8"
  }
}
```

## 🚀 部署建議

1. **開發環境**: 啟用所有功能和日誌
2. **測試環境**: 啟用用戶確認，限制進階工具
3. **生產環境**: 嚴格的安全限制，最小化工具集

## 🤝 貢獻指南

1. Fork 專案
2. 創建功能分支
3. 提交變更
4. 創建 Pull Request

## 📄 授權

MIT License

## 🆘 支援

如有問題，請創建 Issue 或聯繫開發團隊。
