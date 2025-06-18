# AI Agent 整合使用指南

## 🎯 概述

本指南展示如何將新的統一 Function Call 系統整合到現有的 AI Agent 中。

## 🏗️ 系統架構

### 核心組件

```
統一 Function Call 系統
├── src/lib/functions/           # 核心工具系統
│   ├── index.ts                # 主要導出和工具管理
│   ├── categories.ts           # 工具分類定義
│   ├── types.ts               # TypeScript 類型定義
│   ├── ai/                    # AI 相關工具
│   ├── docker/                # Docker 相關工具
│   ├── filesystem/            # 檔案系統工具
│   ├── project/               # 專案管理工具
│   ├── system/                # 系統監控工具
│   └── langchain-binder.ts    # Langchain 整合綁定器
├── src/lib/ai/                 # AI Agent 整合
│   └── unified-ai-agent-integration.ts
└── src/app/api/chat/          # API 路由
    └── unified-route.ts       # 統一聊天 API
```

## 🚀 快速開始

### 基本整合

```typescript
import {
  createUnifiedAIAgent,
  UnifiedAgentConfig,
} from "../lib/ai/unified-ai-agent-integration";

// 創建 AI Agent 實例
const agent = createUnifiedAIAgent({
  model: "gpt-4o",
  temperature: 0.1,
  enableToolSelection: true,
  enableLogging: true,
});

// 配置 Agent
const config: UnifiedAgentConfig = {
  projectId: "my-project",
  projectName: "My Next.js App",
  containerId: "ai-web-ide-my-project-123",
  apiKey: process.env.OPENAI_API_KEY!,
  maxIterations: 10,
  contextWindow: 20,
};

// 處理用戶訊息
const response = await agent.processMessage(
  "session-123",
  "請幫我查看專案結構",
  config
);

console.log(response.message);
console.log(`使用了 ${response.toolCalls.length} 個工具`);
```

### 2. API 路由整合

```typescript
// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createUnifiedAIAgent } from "../../../lib/ai/unified-ai-agent-integration";

const globalAgent = createUnifiedAIAgent();

export async function POST(request: NextRequest) {
  const { message, projectId, apiToken } = await request.json();

  const response = await globalAgent.processMessage(
    `session_${projectId}`,
    message,
    {
      projectId,
      projectName: projectId,
      apiKey: apiToken,
      enableToolSelection: true,
    }
  );

  return NextResponse.json({
    message: response.message,
    toolCalls: response.toolCalls.length,
    sessionInfo: response.sessionInfo,
  });
}
```

## 🛠️ 可用工具類別

### AI 工具 (4 個)

- `aiAgentExecute`: 執行 AI 代理任務
- `aiChatSession`: 管理聊天會話
- `aiToolRegistry`: 工具註冊表管理
- `aiContextManager`: 上下文和記憶管理

### Docker 工具 (10 個)

- `dockerContainerManager`: 容器生命週期管理
- `dockerFileOperations`: 檔案操作
- `dockerCommandExecutor`: 命令執行
- `dockerHealthChecker`: 健康檢查
- `dockerLogManager`: 日誌管理
- `dockerNetworkManager`: 網路管理
- `dockerVolumeManager`: 卷管理
- `dockerImageManager`: 映像管理
- `dockerComposeManager`: Docker Compose 管理
- `dockerSecurityScanner`: 安全掃描

### 檔案系統工具 (6 個)

- `fileReader`: 檔案讀取
- `fileWriter`: 檔案寫入
- `directoryManager`: 目錄管理
- `fileSearcher`: 檔案搜尋
- `fileBatchProcessor`: 批量處理
- `filePermissionManager`: 權限管理

### 專案管理工具 (4 個)

- `projectInfo`: 專案資訊
- `workspaceManager`: 工作區管理
- `codeAnalyzer`: 程式碼分析
- `devToolsHelper`: 開發工具輔助

### 系統監控工具 (4 個)

- `systemMonitor`: 系統資源監控
- `logManager`: 日誌管理
- `debugHelper`: 調試輔助
- `securityValidator`: 安全驗證

### 網路工具 (5 個)

- `httpClient`: HTTP 客戶端
- `apiTester`: API 測試
- `webhookManager`: Webhook 管理
- `networkDiagnostic`: 網路診斷
- `proxyManager`: 代理管理

### 實用工具 (4 個)

- `textProcessor`: 文字處理
- `dataTransformer`: 資料轉換
- `calculatorHelper`: 計算輔助
- `validationHelper`: 驗證輔助

## 🎨 進階使用

### 智能工具選擇

```typescript
import { selectToolsForRequest } from "../lib/functions/langchain-binder";

const userMessage = "請幫我檢查 Docker 容器狀態";
const relevantTools = selectToolsForRequest(userMessage);
```

### 工具搜尋和過濾

```typescript
import { searchTools, toolsByCategory } from "../lib/functions";

// 搜尋特定功能的工具
const dockerTools = searchTools("docker container");
const fileTools = toolsByCategory.filesystem;

// 獲取高優先級工具
import { createHighPriorityToolsForAgent } from "../lib/functions/langchain-binder";
const priorityTools = createHighPriorityToolsForAgent();
```

### 自定義 Agent 配置

```typescript
const customAgent = createUnifiedAIAgent({
  model: "gpt-4o",
  temperature: 0.2,
  maxTokens: 8000,
  maxIterations: 15,
  contextWindow: 30,
  enableVectorStore: true,
  enableToolSelection: true,
  enableLogging: true,
});
```

## 📊 監控和調試

### 會話統計

```typescript
const stats = agent.getSessionStats();
console.log(`活躍會話: ${stats.activeSessions}`);
```

### 工具調用監控

```typescript
const response = await agent.processMessage(sessionId, message, config);

// 分析工具調用
response.toolCalls.forEach((call) => {
  console.log(`工具: ${call.toolName}`);
  console.log(`成功: ${call.success}`);
  console.log(`耗時: ${call.duration}ms`);
  if (call.error) {
    console.log(`錯誤: ${call.error}`);
  }
});
```

## 🔄 從舊系統遷移

### 遷移步驟

1. **識別現有工具調用**

```typescript
// 舊的方式
import { createLangchainChatEngine } from "../lib/ai/langchain-chat-engine";

// 新的方式
import { createUnifiedAIAgent } from "../lib/ai/unified-ai-agent-integration";
```

2. **更新工具註冊**

```typescript
// 舊的方式
const tools = await this.createProjectTools(projectContext);

// 新的方式
const tools = selectToolsForRequest(userMessage);
// 或者使用預設的高優先級工具集
const tools = createHighPriorityToolsForAgent();
```

3. **更新 API 調用**

```typescript
// 舊的 API 格式
const response = await chatEngine.processMessage(
  sessionId,
  message,
  projectContext
);

// 新的 API 格式
const response = await agent.processMessage(sessionId, message, config);
```

### 向後相容性

舊的模組仍然可用，但會顯示遷移警告：

```typescript
import { showMigrationWarning } from "../lib/ai/langchain-chat-engine";

// 會顯示遷移指引
showMigrationWarning();
```

## 🎯 實際使用案例

### 案例 1: 專案探索

```typescript
const agent = createUnifiedAIAgent();

const response = await agent.processMessage(
  "explore-session",
  "請分析這個 Next.js 專案的結構",
  config
);

// AI 會自動選擇並使用：
// - projectInfo: 獲取專案基本資訊
// - directoryManager: 探索目錄結構
// - fileReader: 讀取配置檔案
// - codeAnalyzer: 分析程式碼架構
```

### 案例 2: Docker 容器管理

```typescript
const response = await agent.processMessage(
  "docker-session",
  "檢查容器狀態，如果有問題請重啟",
  config
);

// AI 會自動選擇並使用：
// - dockerHealthChecker: 檢查容器健康狀態
// - dockerLogManager: 查看錯誤日誌
// - dockerContainerManager: 重啟容器（如需要）
```

### 案例 3: 程式碼調試

```typescript
const response = await agent.processMessage(
  "debug-session",
  "我的應用程式啟動失敗，請幫我檢查和修復",
  {
    projectId: "my-app",
    apiKey: process.env.OPENAI_API_KEY!,
    enableLogging: true,
  }
);

// AI 會自動選擇並使用：
// - dockerLogManager: 查看啟動日誌
// - fileReader: 檢查配置檔案
// - debugHelper: 分析錯誤原因
// - fileWriter: 修復配置問題
```

## 📈 性能優化

### 工具選擇優化

```typescript
// 使用智能工具選擇減少不必要的工具載入
const config: UnifiedAgentConfig = {
  // ... 其他配置
  enableToolSelection: true, // 根據請求動態選擇工具
  maxIterations: 8, // 限制迭代次數
  contextWindow: 15, // 優化上下文窗口大小
};
```

### 記憶體管理

```typescript
// 定期清理過期會話
setInterval(() => {
  // 清理超過 24 小時的會話
  agent.cleanupExpiredSessions(24 * 60 * 60 * 1000);
}, 60 * 60 * 1000); // 每小時執行一次
```

## 🔒 安全考量

### API Key 管理

```typescript
// 使用環境變數
const config: UnifiedAgentConfig = {
  apiKey: process.env.OPENAI_API_KEY!,
  // 避免在日誌中記錄敏感資訊
  enableLogging: process.env.NODE_ENV !== "production",
};
```

### 工具權限控制

```typescript
// 根據用戶權限選擇工具
const allowedCategories = user.isAdmin
  ? ["ai", "docker", "filesystem", "project", "system"]
  : ["ai", "filesystem", "project"];

const tools = allowedCategories.flatMap((cat) => toolsByCategory[cat] || []);
```

## 🧪 測試

### 單元測試

```typescript
import { createUnifiedAIAgent } from "../lib/ai/unified-ai-agent-integration";

describe("Unified AI Agent", () => {
  it("should create agent successfully", () => {
    const agent = createUnifiedAIAgent();
    expect(agent).toBeDefined();
    expect(agent.getSessionStats().activeSessions).toBe(0);
  });

  it("should select appropriate tools for Docker requests", () => {
    const tools = selectToolsForRequest("check docker container status");
    expect(tools.some((t) => t.name.includes("docker"))).toBe(true);
  });
});
```

### 整合測試

```typescript
// 使用模擬 API Key 進行測試
const mockConfig: UnifiedAgentConfig = {
  projectId: "test-project",
  projectName: "Test Project",
  apiKey: "mock-api-key",
  enableLogging: false,
};

// 測試基本功能（不會實際調用 OpenAI API）
const agent = createUnifiedAIAgent();
expect(() => agent.getSessionStats()).not.toThrow();
```

## 📚 參考資料

- [統一 Function Call 系統文檔](./unified-function-call-system.md)
- [工具分類和權限管理](./tool-categories.md)
- [Langchain 整合指南](./langchain-integration.md)
- [API 參考文檔](./api-reference.md)

## 🆘 支援

如果遇到問題：

1. 檢查 [常見問題解答](./faq.md)
2. 查看 [故障排除指南](./troubleshooting.md)
3. 提交 [GitHub Issue](https://github.com/your-repo/issues)
4. 聯繫開發團隊

---

**最後更新**: 2024 年 12 月 28 日  
**版本**: 1.0.0  
**狀態**: ✅ 已完成
