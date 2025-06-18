# 統一 OpenAI Function Call 系統

## 📋 概述

為了提供更統一、結構化和易維護的 AI 工具體驗，我們將所有 AI 相關工具整合到統一的 OpenAI Function Call 系統中。新系統位於 `src/lib/functions/`，按功能分類組織，提供標準化的介面和更強大的功能。

## 🏗️ 架構設計

### 目錄結構

```
src/lib/functions/
├── categories.ts          # 工具分類定義和元數據
├── types.ts              # 統一的類型定義
├── index.ts              # 主要導出和工具管理
├── migration-manager.ts  # 遷移管理器
├── ai/                   # AI 相關工具
│   └── index.ts         # AI 代理、聊天、工具註冊表等
├── docker/              # Docker 容器工具
│   └── index.ts         # Docker 操作工具
├── filesystem/          # 檔案系統工具
│   └── index.ts         # 檔案操作工具
├── network/             # 網路工具
│   └── index.ts         # HTTP 請求、DNS 等
├── project/             # 專案管理工具
│   └── index.ts         # 專案分析、工作區管理等
├── system/              # 系統工具
│   └── index.ts         # 監控、日誌、調試、安全等
└── utility/             # 實用工具
    └── index.ts         # 格式化、編碼等輔助工具
```

### 工具分類

| 分類               | 圖示 | 優先級 | 描述                      |
| ------------------ | ---- | ------ | ------------------------- |
| 🔒 Security        | 🔒   | 10     | 安全驗證和保護工具        |
| 🤖 AI Agent        | 🤖   | 10     | AI 代理和控制器工具       |
| 🐳 Docker          | 🐳   | 9      | Docker 容器操作和管理工具 |
| 💬 AI Chat         | 💬   | 9      | AI 對話和聊天工具         |
| 📁 Filesystem      | 📁   | 9      | 檔案和目錄操作工具        |
| 💻 Code            | 💻   | 9      | 程式碼分析和處理工具      |
| 🧠 AI Tools        | 🧠   | 8      | 通用 AI 輔助工具          |
| 📦 Container       | 📦   | 8      | 通用容器操作工具          |
| 📄 File Operations | 📄   | 8      | 檔案讀寫和處理工具        |
| 🏗️ Project         | 🏗️   | 8      | 專案和工作區管理工具      |
| 🛠️ Development     | 🛠️   | 8      | 軟體開發輔助工具          |

## 🔧 核心功能

### 1. 統一的工具定義格式

每個工具都遵循標準的 `FunctionDefinition` 格式：

```typescript
interface FunctionDefinition {
  name: string; // 工具名稱
  description: string; // 工具描述
  parameters: OpenAIFunctionSchema; // OpenAI Function Call 參數定義
  metadata: FunctionMetadata; // 工具元數據
  validator?: FunctionValidator; // 參數驗證器
  handler: FunctionHandler; // 工具處理器
}
```

### 2. 權限管理

支援三級權限控制：

- `PUBLIC`: 公開工具，任何人都可使用
- `RESTRICTED`: 受限工具，需要基本權限
- `ADMIN`: 管理員工具，需要管理員權限

### 3. 速率限制

每個工具都可配置速率限制：

```typescript
rateLimit: {
  requests: 30,    // 每個時間窗口的最大請求數
  window: 60000    // 時間窗口（毫秒）
}
```

### 4. 參數驗證

內建參數驗證機制，確保輸入安全：

```typescript
validator: async (params) => {
  if (!params.filePath || typeof params.filePath !== "string") {
    return { isValid: false, reason: "檔案路徑是必需的且必須是字串" };
  }
  return { isValid: true };
};
```

## 🔄 遷移指南

### 主要遷移映射

| 舊工具                               | 新工具             | 位置                       |
| ------------------------------------ | ------------------ | -------------------------- |
| `DockerTools.readFileFromDocker`     | `dockerReadFile`   | `src/lib/functions/docker` |
| `AgentController.runAgentController` | `aiAgentExecute`   | `src/lib/functions/ai`     |
| `OpenAIIntegration.sendMessage`      | `aiChatSession`    | `src/lib/functions/ai`     |
| `ToolRegistry.register`              | `aiToolRegistry`   | `src/lib/functions/ai`     |
| `AIContextManager.store`             | `aiContextManager` | `src/lib/functions/ai`     |
| `AIOutputLogger.log`                 | `logManager`       | `src/lib/functions/system` |

### 遷移步驟

1. **識別使用的舊工具**

   ```bash
   # 搜尋代碼中的舊工具引用
   grep -r "DockerTools\|AgentController\|OpenAIIntegration" src/
   ```

2. **更新導入語句**

   ```typescript
   // 舊的導入
   import { DockerTools } from "../ai/docker-tools";

   // 新的導入
   import { dockerReadFile } from "../functions/docker";
   ```

3. **更新函數調用**

   ```typescript
   // 舊的調用方式
   const result = await dockerTools.readFileFromDocker("package.json");

   // 新的調用方式
   const result = await dockerReadFile({ filePath: "package.json" });
   ```

4. **更新錯誤處理**
   ```typescript
   // 新的標準化返回格式
   if (result.success) {
     console.log("操作成功:", result.data);
   } else {
     console.error("操作失敗:", result.error);
   }
   ```

## 📚 使用範例

### AI 代理執行

```typescript
import { aiAgentExecute } from "../functions/ai";

const result = await aiAgentExecute({
  message: "分析這個專案的結構並提供改進建議",
  systemPrompt: "你是一個專業的程式碼審查員",
  maxToolCalls: 10,
  enableLogging: true,
});

if (result.success) {
  console.log("AI 回應:", result.data.response);
  console.log("使用的工具調用數:", result.data.toolCallsUsed);
}
```

### Docker 檔案操作

```typescript
import { dockerReadFile, dockerListDirectory } from "../functions/docker";

// 讀取檔案
const fileResult = await dockerReadFile({
  filePath: "src/app/page.tsx",
  mode: "strict",
  projectName: "my-project",
});

// 列出目錄
const dirResult = await dockerListDirectory({
  dirPath: "src",
  mode: "strict",
});
```

### 聊天會話管理

```typescript
import { aiChatSession } from "../functions/ai";

// 創建會話
const createResult = await aiChatSession({
  action: "create",
  config: {
    model: "gpt-4o",
    temperature: 0.7,
    maxTokens: 2000,
  },
});

// 發送訊息
const sendResult = await aiChatSession({
  action: "send",
  sessionId: createResult.data.sessionId,
  message: "你好！請幫我分析這個程式碼。",
});
```

### 系統監控

```typescript
import { systemMonitor, logManager } from "../functions/system";

// 監控系統資源
const monitorResult = await systemMonitor({
  metrics: ["cpu", "memory", "disk"],
  interval: 0, // 單次檢查
});

// 查詢日誌
const logResult = await logManager({
  action: "query",
  logLevel: "error",
  limit: 50,
  startTime: "2024-01-01T00:00:00Z",
});
```

## 🛠️ 開發指南

### 添加新工具

1. **選擇適當的分類**

   ```typescript
   // 在 categories.ts 中選擇或添加分類
   category: ToolCategory.AI_AGENT;
   ```

2. **定義工具**

   ```typescript
   export const myNewTool: FunctionDefinition = {
     name: "myNewTool",
     description: "我的新工具描述",
     parameters: {
       type: "object",
       properties: {
         input: {
           type: "string",
           description: "輸入參數",
         },
       },
       required: ["input"],
     },
     metadata: {
       category: ToolCategory.AI_TOOLS,
       accessLevel: FunctionAccessLevel.PUBLIC,
       version: "1.0.0",
       author: "Your Name",
       tags: ["utility", "helper"],
       rateLimit: {
         requests: 30,
         window: 60000,
       },
     },
     validator: async (params) => {
       // 參數驗證邏輯
       return { isValid: true };
     },
     handler: async (params) => {
       try {
         // 工具實現邏輯
         return {
           success: true,
           data: { result: "success" },
           message: "操作成功",
         };
       } catch (error) {
         return {
           success: false,
           error: `操作失敗: ${error}`,
         };
       }
     },
   };
   ```

3. **導出工具**
   ```typescript
   // 在對應分類的 index.ts 中
   export const myTools: FunctionDefinition[] = [
     myNewTool,
     // ... 其他工具
   ];
   ```

### 測試工具

```typescript
import { myNewTool } from "../functions/my-category";

// 測試參數驗證
const validation = await myNewTool.validator?.({ input: "test" });
console.log("驗證結果:", validation);

// 測試工具執行
const result = await myNewTool.handler({ input: "test" });
console.log("執行結果:", result);
```

## 📊 統計資訊

當前系統包含：

- **總工具數**: 20+ 個統一工具
- **分類數**: 14 個功能分類
- **高優先級工具**: 12 個（優先級 ≥ 8）
- **權限等級**: 3 級權限管理
- **遷移工具**: 25+ 個舊工具已遷移

## 🔮 未來規劃

1. **擴展工具類別**

   - 資料庫操作工具
   - 雲端服務整合工具
   - 更多 AI 模型整合

2. **增強功能**

   - 工具執行歷史記錄
   - 自動化測試框架
   - 性能監控和優化

3. **開發者體驗**
   - 視覺化工具管理介面
   - 自動化文檔生成
   - 更好的錯誤診斷

## 📞 支援

如果在遷移或使用過程中遇到問題：

1. 查看遷移管理器的建議：

   ```typescript
   import { migrationManager } from "../functions/migration-manager";
   const suggestion = migrationManager.findNewToolName("舊工具名稱");
   ```

2. 參考完整的遷移報告：

   ```typescript
   const report = migrationManager.generateMigrationReport();
   console.log(report);
   ```

3. 查看工具文檔：
   ```typescript
   import { generateToolDocumentation } from "../functions";
   const docs = generateToolDocumentation();
   ```

---

_最後更新: 2024 年 12 月_
_版本: 2.0.0_
