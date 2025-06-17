# AI 工具控制框架使用指南

## 🎯 概述

AI 工具控制框架（Tool-calling Agent Controller）是一個讓 AI 能夠「先 tool → 看結果 → 再決定」的智能控制系統。它允許 LLM 自主決定是否需要呼叫工具，並根據工具的執行結果來決定下一步操作。

## 🏗️ 架構設計

```
┌─────────────────┐
│   User Prompt   │
└────────┬────────┘
         ↓
┌─────────────────┐
│      LLM        │
│   推論是否需要   │
│   Tool 呼叫      │
└────────┬────────┘
         ↓（若需要）
┌─────────────────┐
│   Tool Call     │
│  (callTool)     │
└────────┬────────┘
         ↓
┌─────────────────┐
│  Tool Output    │─────┐
└─────────────────┘     │
         ↓              │
┌─────────────────┐     │
│   LLM 再推論     │◀────┘
│ 決定：回答 or 再 call tool │
└─────────────────┘
```

## 🚀 快速開始

### 1. 基本使用

```typescript
import { AgentFactory } from "../src/lib/ai";

// 快速使用
const factory = AgentFactory.getInstance();
const result = await factory.quickRun("請幫我找出首頁的程式碼長怎樣");
console.log(result);
```

### 2. 自訂配置

```typescript
const config = {
  maxToolCalls: 5, // 最大工具呼叫次數（防暴走）
  maxRetries: 2, // 最大重試次數
  timeoutMs: 30000, // 單次工具呼叫超時時間
  enableLogging: true, // 是否啟用日誌
};

const result = await factory.quickRun("分析專案結構", config);
```

### 3. 手動建立 Agent 控制器

```typescript
const agent = await factory.createAgentController({
  enableLogging: true,
  maxToolCalls: 5,
});

const result = await agent.runAgentController("檢查 package.json 檔案");
```

## 🛠️ 可用工具

框架目前支援以下 Docker 容器內的操作工具：

| 工具名稱                   | 功能描述         | 參數                                   |
| -------------------------- | ---------------- | -------------------------------------- |
| `docker_read_file`         | 讀取檔案內容     | `filePath: string`                     |
| `docker_list_directory`    | 列出目錄內容     | `dirPath?: string`                     |
| `docker_check_path_exists` | 檢查路徑是否存在 | `path: string`                         |
| `docker_find_files`        | 搜尋檔案         | `pattern: string, searchPath?: string` |
| `docker_get_file_info`     | 獲取檔案詳細資訊 | `filePath: string`                     |

## 📋 預設測試案例

```typescript
// 使用預設測試案例
await factory.runTestCase("LIST_DIRECTORY");
await factory.runTestCase("FIND_INDEX_FILE");
await factory.runTestCase("CHECK_PACKAGE_JSON");
await factory.runTestCase("FIND_REACT_COMPONENTS");
await factory.runTestCase("PROJECT_STRUCTURE");
```

## 🔧 系統測試與診斷

### 執行系統測試

```typescript
import { systemDiagnostic } from "../src/lib/ai";

const diagnostic = await systemDiagnostic();
console.log(`測試結果: ${diagnostic.success}`);
console.log(`訊息: ${diagnostic.message}`);
```

### 檢查系統狀態

```typescript
const factory = AgentFactory.getInstance();
const status = factory.getSystemStatus();
console.log("系統狀態:", status);
```

### 使用測試腳本

```bash
# 執行完整的系統測試
npx ts-node scripts/test-agent-framework.ts
```

## 🎨 使用範例

### 範例 1: 分析專案結構

```typescript
const result = await factory.quickRun(`
  請幫我分析這個專案的結構，包括：
  1. 主要目錄和檔案
  2. 使用的技術棧
  3. 專案類型（React、Next.js 等）
`);
```

### 範例 2: 尋找特定檔案

```typescript
const result = await factory.quickRun(
  "請找出所有的 React 元件檔案（.tsx 檔案）"
);
```

### 範例 3: 檢查專案配置

```typescript
const result = await factory.quickRun(
  "請檢查 package.json 並告訴我這個專案的依賴套件"
);
```

## ⚙️ 配置選項

### AgentFactoryConfig

```typescript
interface AgentFactoryConfig {
  // Docker 配置
  dockerContainerId?: string; // Docker 容器 ID
  dockerWorkingDirectory?: string; // 工作目錄

  // OpenAI 配置
  openaiApiKey?: string; // OpenAI API 金鑰
  openaiModel?: string; // 使用的模型

  // Agent 配置
  maxToolCalls?: number; // 最大工具呼叫次數
  maxRetries?: number; // 最大重試次數
  timeoutMs?: number; // 超時時間
  enableLogging?: boolean; // 是否啟用日誌
}
```

## 🔒 安全機制

### 1. 防暴走機制

- **最大工具呼叫次數限制**：預設最多 5 次工具呼叫
- **超時保護**：單次工具呼叫預設 30 秒超時
- **重試限制**：工具執行失敗最多重試 2 次

### 2. 錯誤處理

- **工具執行異常捕獲**：自動捕獲並記錄工具執行錯誤
- **參數驗證**：驗證工具參數的類型和必需性
- **優雅降級**：工具失敗時提供有意義的錯誤訊息

## 📊 日誌與監控

### 啟用詳細日誌

```typescript
const config = {
  enableLogging: true, // 啟用框架日誌
};
```

### 日誌層級

- `🚀` 系統啟動和初始化
- `🧠` LLM 推論過程
- `🛠️` 工具呼叫和執行
- `✅` 成功操作
- `❌` 錯誤和異常
- `⚠️` 警告訊息

## 🧪 測試與驗證

### 1. 快速驗證

```typescript
import { quickTestAgent } from "../src/lib/ai";

const result = await quickTestAgent("測試訊息");
```

### 2. 完整系統測試

```typescript
import { AgentUsageExamples } from "../src/lib/ai";

await AgentUsageExamples.runAllExamples();
```

### 3. 工具連接性測試

```typescript
const factory = AgentFactory.getInstance();
const agent = await factory.createAgentController();
const toolRegistry = agent.toolRegistry;
const testResults = await toolRegistry.testAllTools();
```

## 🔄 最佳實踐

### 1. 訊息設計

- **明確的指令**：提供清晰、具體的任務描述
- **適當的範圍**：避免過於複雜或模糊的要求
- **上下文資訊**：提供必要的背景資訊

### 2. 配置調整

- **開發環境**：啟用詳細日誌，較短的超時時間
- **生產環境**：關閉詳細日誌，適當的重試次數
- **測試環境**：較低的工具呼叫限制

### 3. 錯誤處理

- **捕獲異常**：始終使用 try-catch 處理 Agent 呼叫
- **檢查結果**：驗證返回結果的完整性
- **降級策略**：準備備用方案

## 🚨 故障排除

### 常見問題

1. **Docker 連接失敗**

   ```
   檢查 Docker 容器是否正在運行
   驗證容器 ID 是否正確
   確認工作目錄路徑
   ```

2. **工具執行超時**

   ```
   增加 timeoutMs 配置
   檢查 Docker 容器性能
   減少單次處理的資料量
   ```

3. **LLM 呼叫失敗**
   ```
   檢查 OpenAI API 金鑰
   驗證網路連接
   確認 API 配額
   ```

### 除錯技巧

1. **啟用詳細日誌**

   ```typescript
   const config = { enableLogging: true };
   ```

2. **使用系統診斷**

   ```typescript
   const diagnostic = await systemDiagnostic();
   ```

3. **檢查工具狀態**
   ```typescript
   const status = factory.getSystemStatus();
   ```

## 📈 擴展開發

### 添加自訂工具

```typescript
const toolRegistry = new EnhancedToolRegistry(dockerManager);

toolRegistry.addCustomTool(
  "custom_tool_name",
  "工具描述",
  {
    type: "object",
    properties: {
      param1: { type: "string", description: "參數描述" },
    },
    required: ["param1"],
  },
  async (params) => {
    // 自訂工具邏輯
    return { success: true, data: "result" };
  }
);
```

### 自訂系統提示詞

```typescript
const customPrompt = `
你是一個專門處理程式碼分析的 AI 助手...
可用工具: ${toolNames.join(", ")}
特殊規則: ...
`;

const result = await agent.runAgentController(userMessage, customPrompt);
```

## 🤝 貢獻指南

歡迎貢獻代碼和建議！請遵循以下步驟：

1. Fork 專案
2. 建立功能分支
3. 添加測試案例
4. 確保所有測試通過
5. 提交 Pull Request

## 📄 授權

本專案採用 MIT 授權條款。
