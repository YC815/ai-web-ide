# Langchain 聊天系統重構指南

## 🎯 重構目標

將現有的 AI Project Assistant 重構為使用 Langchain 的高品質聊天引擎，重點改善：

1. **上下文管理** - 使用 Langchain Memory 和向量存儲
2. **工具調用** - 基於 Agent 的智能工具選擇和執行
3. **重試邏輯** - 智能錯誤處理和自動修正
4. **決策系統** - AI 自主決定工作流程
5. **透明度** - 完整的思考過程和執行記錄

## 📊 架構對比

### 原有架構 vs Langchain 架構

| 功能       | 原有架構     | Langchain 架構                 |
| ---------- | ------------ | ------------------------------ |
| 對話記憶   | 簡單陣列存儲 | ConversationBufferWindowMemory |
| 上下文管理 | 手動快照系統 | MemoryVectorStore + 相似性搜尋 |
| 工具調用   | 手動意圖識別 | AgentExecutor + 智能工具選擇   |
| 重試邏輯   | 固定循環     | 適應性重試策略                 |
| 決策系統   | 規則式判斷   | LLM 驅動的智能決策             |
| 透明度     | 基本日誌     | 結構化思考過程                 |

## 🚀 核心改進

### 1. 智能上下文管理

**問題**: 原有系統上下文管理不完善，AI 經常忘記之前的對話和專案狀態。

**解決方案**:

- 使用 `ConversationBufferWindowMemory` 管理對話歷史
- 使用 `MemoryVectorStore` 進行專案上下文的向量化存儲
- 智能相似性搜尋提取相關資訊

```typescript
// 原有方式
class AIProjectAssistant {
  private conversationHistory: ChatMessage[] = [];

  addToHistory(message: ChatMessage): void {
    this.conversationHistory.push(message);
    // 簡單的記憶體管理
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-40);
    }
  }
}

// Langchain 方式
const memory = new ConversationBufferWindowMemory({
  k: 20, // 保留最近 20 條訊息
  memoryKey: "chat_history",
  returnMessages: true,
  outputKey: "output",
  inputKey: "input",
});

const vectorStore = new MemoryVectorStore(embeddings);
// 自動向量化和相似性搜尋
const relevantContext = await vectorStore.similaritySearch(query, 3);
```

### 2. 智能工具調用

**問題**: 手動意圖識別不夠精確，工具調用邏輯固化。

**解決方案**:

- 使用 `createStructuredChatAgent` 智能選擇工具
- Agent 自動決定何時使用哪個工具
- 透明的工具執行記錄

```typescript
// 原有方式
private analyzeUserIntent(message: string): {type: string, details: any} {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('創建') || lowerMessage.includes('建立')) {
    return { type: 'file_operation', details: { message } };
  }
  // ... 更多規則式判斷
}

// Langchain 方式
const agent = await createStructuredChatAgent({
  llm: this.model,
  tools,
  prompt // AI 自動決定使用哪個工具
});

const executor = new AgentExecutor({
  agent,
  tools,
  memory,
  verbose: true,
  maxIterations: 5
});
```

### 3. 智能決策系統

**問題**: 固定的重試邏輯，無法適應不同情況。

**解決方案**:

- LLM 驅動的決策系統
- 基於上下文的信心度評估
- 適應性重試策略

```typescript
// 原有方式 - 固定邏輯
if (this.autoRepairMode) {
  while (this.currentRepairAttempt < this.maxRepairAttempts) {
    // 固定的重試邏輯
  }
}

// Langchain 方式 - 智能決策
const decision = await this.makeIntelligentDecision(
  session,
  userMessage,
  lastError,
  retryCount
);

// AI 決定下一步行動
if (decision.decision === "continue_tools") {
  // 繼續使用工具
} else if (decision.decision === "respond_to_user") {
  // 直接回應用戶
} else {
  // 需要用戶輸入
}
```

## 📋 遷移步驟

### Step 1: 安裝依賴

```bash
npm install @langchain/core @langchain/openai langchain
```

### Step 2: 配置環境變數

```env
OPENAI_API_KEY=sk-your-api-key
LANGCHAIN_TRACING_V2=true  # 可選
LANGCHAIN_PROJECT=ai-web-ide
```

### Step 3: 整合到現有 API

```typescript
// 在 /api/chat/route.ts 中
import { createLangchainChatEngine } from "../../../lib/ai/langchain-chat-engine";

// 使用新的 Langchain 引擎
const chatEngine = createLangchainChatEngine(apiToken, {
  model: "gpt-4o",
  temperature: 0.1,
});

const response = await chatEngine.processMessage(
  sessionId,
  message,
  projectContext
);
```

### Step 4: 前端適配

```typescript
// 前端調用新的 API
const response = await fetch("/api/chat/langchain", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: userMessage,
    projectId,
    projectName,
    apiToken,
    sessionId, // 保持會話連續性
  }),
});

const result = await response.json();
// 新的回應結構包含更豐富的資訊
console.log(result.data.thoughtProcess); // AI 思考過程
console.log(result.data.toolCalls); // 工具調用記錄
console.log(result.data.autoActions); // 自動執行的動作
```

## 🔧 關鍵技術亮點

### 1. 向量化上下文存儲

```typescript
// 將專案資訊轉換為向量文檔
const docs = [
  new Document({
    pageContent: `專案名稱: ${snapshot.projectInfo.name}`,
    metadata: { type: "project_info" },
  }),
  new Document({
    pageContent: `檔案結構:\n${snapshot.fileStructure.files.join("\n")}`,
    metadata: { type: "file_structure" },
  }),
];

await session.vectorStore.addDocuments(docs);
```

### 2. 動態工具創建

```typescript
const tools: Tool[] = [
  new DynamicTool({
    name: "get_project_snapshot",
    description: "獲取當前專案的完整快照",
    func: async () => {
      const result = await contextManager.getProjectSnapshot(true);
      return result.success ? JSON.stringify(result.data, null, 2) : "無法獲取";
    },
  }),
  // ... 更多工具
];
```

### 3. 智能決策鏈

```typescript
const decisionPrompt = ChatPromptTemplate.fromMessages([
  new SystemMessagePromptTemplate({
    template: `分析用戶請求並決定最佳行動方案...`,
  }),
  new HumanMessagePromptTemplate({
    template: "用戶請求: {userMessage}",
  }),
]);

const decisionChain = decisionPrompt
  .pipe(this.model)
  .pipe(new StringOutputParser());
```

## 📈 性能改進

### 對話連續性

- **原有**: 每次請求重新構建上下文 ❌
- **新版**: 持久化會話記憶 ✅

### 工具執行效率

- **原有**: 固定的意圖識別和工具調用 ❌
- **新版**: AI 智能選擇最適合的工具 ✅

### 錯誤處理

- **原有**: 簡單的重試循環 ❌
- **新版**: 基於上下文的適應性重試 ✅

### 透明度

- **原有**: 基本的執行日誌 ❌
- **新版**: 完整的思考過程和決策記錄 ✅

## 🧪 測試和驗證

### 測試對話連續性

```typescript
// 測試 1: 多輪對話記憶
const engine = createLangchainChatEngine(apiKey);

// 第一輪
await engine.processMessage("session1", "創建一個登入頁面", projectContext);

// 第二輪 - 測試是否記住之前的對話
const response = await engine.processMessage(
  "session1",
  "為這個頁面添加樣式",
  projectContext
);
// 應該理解 "這個頁面" 指的是登入頁面
```

### 測試工具調用智能性

```typescript
// 測試 2: 工具選擇智能性
const response = await engine.processMessage(
  "session2",
  "檢查專案狀態並創建缺失的配置檔案",
  projectContext
);

// 應該自動:
// 1. 使用 get_project_snapshot 檢查狀態
// 2. 分析缺失的檔案
// 3. 使用 create_file 創建檔案
console.log(response.toolCalls); // 查看執行的工具序列
```

### 測試錯誤處理

```typescript
// 測試 3: 錯誤處理和重試
const response = await engine.processMessage(
  "session3",
  "創建一個不存在路徑的檔案",
  projectContext
);

// 應該:
// 1. 嘗試創建檔案
// 2. 檢測到路徑錯誤
// 3. 自動創建必要的目錄
// 4. 重新嘗試創建檔案
console.log(response.thoughtProcess); // 查看決策過程
```

## 📚 API 參考

### LangchainChatEngine

```typescript
interface LangchainChatEngine {
  // 處理用戶訊息
  processMessage(
    sessionId: string,
    userMessage: string,
    projectContext: ProjectContext
  ): Promise<LangchainChatResponse>;

  // 獲取會話統計
  getSessionStats(): {
    activeSessions: number;
    totalMemoryUsage: number;
    oldestSession?: string;
  };

  // 清理過期會話
  cleanupExpiredSessions(maxAge?: number): void;
}
```

### LangchainChatResponse

```typescript
interface LangchainChatResponse {
  message: string; // AI 回應訊息
  toolCalls?: ToolCall[]; // 執行的工具調用
  thoughtProcess?: ThoughtProcess; // AI 思考過程
  contextUpdate?: ContextUpdate; // 上下文更新資訊
  autoActions?: string[]; // 自動執行的動作
  needsUserInput?: boolean; // 是否需要用戶輸入
  error?: string; // 錯誤訊息
}
```

## 🎯 使用建議

### 1. 開發階段

- 啟用 `verbose: true` 查看詳細的工具執行過程
- 使用 `LANGCHAIN_TRACING_V2=true` 進行詳細追蹤

### 2. 生產環境

- 定期清理過期會話以優化記憶體
- 監控會話統計以了解使用情況
- 設置適當的 `maxIterations` 避免無限循環

### 3. 自定義擴展

- 添加專案特定的工具到 `createProjectTools`
- 調整決策邏輯以符合特定需求
- 擴展向量存儲以包含更多上下文資訊

## 🔄 遷移檢查清單

- [ ] 安裝 Langchain 依賴
- [ ] 配置環境變數
- [ ] 實現新的聊天引擎
- [ ] 創建新的 API 端點
- [ ] 測試對話連續性
- [ ] 測試工具調用
- [ ] 測試錯誤處理
- [ ] 前端整合
- [ ] 性能測試
- [ ] 部署到生產環境

這樣就完成了從原有系統到 Langchain 的全面重構，大幅改善了上下文管理、工具調用和決策系統！
