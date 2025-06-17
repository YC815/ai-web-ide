# AI 輸出記錄器 (AIOutputLogger)

AI 輸出記錄器是一個專門用於記錄 AI 系統文字輸出和決策過程的工具。它支援時間前綴、累加記錄、檔案輪轉等功能，讓您能夠完整追蹤 AI 的行為和決策過程。

## 功能特色

- ✅ **時間前綴記錄**：每條記錄都包含精確的時間戳
- ✅ **累加記錄**：新記錄會附加到現有檔案，不會覆蓋
- ✅ **分類記錄**：支援輸出、決策、錯誤、系統四種記錄類型
- ✅ **檔案輪轉**：自動輪轉大檔案，避免單一檔案過大
- ✅ **元數據支援**：可附加結構化的元數據資訊
- ✅ **統計功能**：提供記錄統計和分析功能
- ✅ **自動清理**：支援自動清理舊記錄檔案

## 快速開始

### 基本使用

```typescript
import { aiOutputLogger } from "@/lib/ai/ai-output-logger";

// 記錄AI輸出
await aiOutputLogger.logOutput("MyAIModule", "生成的回應內容", {
  tokens: 150,
  responseTime: "1.2s",
});

// 記錄決策過程
await aiOutputLogger.logDecision("MyAIModule", "決定使用 gpt-4o 模型", {
  reason: "需要更高的推理能力",
  model: "gpt-4o",
});

// 記錄錯誤
await aiOutputLogger.logError("MyAIModule", "API 呼叫失敗", {
  errorCode: "TIMEOUT",
  retryCount: 2,
});

// 記錄系統事件
await aiOutputLogger.logSystem("MyAIModule", "模組初始化完成", {
  version: "1.0.0",
});
```

### 自訂配置

```typescript
import { AIOutputLogger } from "@/lib/ai/ai-output-logger";

const customLogger = AIOutputLogger.getInstance({
  logDirectory: "./custom-logs",
  logFileName: "my-ai-output.log",
  maxFileSize: 10 * 1024 * 1024, // 10MB
  enableRotation: true,
  enableConsoleOutput: true,
});

await customLogger.initialize();
```

## 記錄格式

記錄檔案採用以下格式：

```
[2024-01-15 14:30:25.123] [OUTPUT] [MyAIModule] 生成的回應內容 | 元數據: {"tokens":150,"responseTime":"1.2s"}
[2024-01-15 14:30:26.456] [DECISION] [MyAIModule] 決定使用 gpt-4o 模型 | 元數據: {"reason":"需要更高的推理能力","model":"gpt-4o"}
[2024-01-15 14:30:27.789] [ERROR] [MyAIModule] API 呼叫失敗 | 元數據: {"errorCode":"TIMEOUT","retryCount":2}
[2024-01-15 14:30:28.012] [SYSTEM] [MyAIModule] 模組初始化完成 | 元數據: {"version":"1.0.0"}
```

## 記錄類型

### OUTPUT - AI 輸出記錄

記錄 AI 生成的文字內容、回應、結果等。

```typescript
await aiOutputLogger.logOutput(
  "ChatBot",
  "您好！我是AI助手，很高興為您服務。",
  {
    inputTokens: 50,
    outputTokens: 25,
    totalTokens: 75,
    model: "gpt-4o",
    temperature: 0.7,
  }
);
```

### DECISION - 決策過程記錄

記錄 AI 的決策邏輯、選擇原因、考慮因素等。

```typescript
await aiOutputLogger.logDecision("AgentController", "決定呼叫檔案讀取工具", {
  toolName: "read_file",
  reason: "使用者要求查看檔案內容",
  alternatives: ["list_directory", "search_file"],
  confidence: 0.95,
});
```

### ERROR - 錯誤記錄

記錄 AI 系統中發生的錯誤、異常、失敗情況。

```typescript
await aiOutputLogger.logError("OpenAIService", "API 請求失敗", {
  errorType: "NetworkError",
  statusCode: 500,
  retryCount: 3,
  maxRetries: 5,
  lastError: "Connection timeout",
});
```

### SYSTEM - 系統事件記錄

記錄系統啟動、初始化、配置變更等系統級事件。

```typescript
await aiOutputLogger.logSystem("AgentFactory", "Agent控制器初始化完成", {
  agentType: "ToolCallingAgent",
  maxToolCalls: 5,
  timeout: 30000,
  enabledTools: ["read_file", "write_file", "list_directory"],
});
```

## 管理功能

### 獲取記錄統計

```typescript
const stats = await aiOutputLogger.getLogStats();
console.log("記錄統計:", stats);
// 輸出：
// {
//   totalLines: 1250,
//   fileSize: 524288,
//   lastModified: 2024-01-15T14:30:28.012Z,
//   recordTypes: {
//     output: 450,
//     decision: 380,
//     error: 120,
//     system: 300
//   }
// }
```

### 獲取最近記錄

```typescript
const recentLogs = await aiOutputLogger.getRecentLogs(50);
recentLogs.forEach((log) => console.log(log));
```

### 清理舊記錄

```typescript
// 清理30天前的記錄檔案
await aiOutputLogger.cleanupOldLogs(30);
```

## 與現有系統整合

AI 輸出記錄器已經整合到以下模組中：

### AgentController

- 記錄使用者請求
- 記錄 LLM 推論決策
- 記錄工具呼叫決策
- 記錄執行結果和錯誤

### OpenAIService

- 記錄 API 請求決策
- 記錄 API 回應內容
- 記錄錯誤和重試

### AgentFactory

- 記錄系統初始化
- 記錄組件建立過程
- 記錄測試結果

## 配置選項

| 選項                  | 類型    | 預設值                | 說明                  |
| --------------------- | ------- | --------------------- | --------------------- |
| `logDirectory`        | string  | `'./logs/ai-outputs'` | 記錄檔案目錄          |
| `logFileName`         | string  | `'ai-output.log'`     | 記錄檔案名稱          |
| `maxFileSize`         | number  | `50MB`                | 最大檔案大小（bytes） |
| `enableRotation`      | boolean | `true`                | 是否啟用檔案輪轉      |
| `enableConsoleOutput` | boolean | `false`               | 是否同時輸出到控制台  |

## 最佳實踐

### 1. 記錄分類原則

- **OUTPUT**: 記錄最終給使用者的回應、生成的內容
- **DECISION**: 記錄重要的決策點、選擇邏輯
- **ERROR**: 記錄所有錯誤和異常情況
- **SYSTEM**: 記錄系統級事件和狀態變化

### 2. 元數據設計

- 包含足夠的上下文資訊
- 使用結構化的資料格式
- 避免包含敏感資訊
- 保持一致的命名慣例

### 3. 效能考量

- 記錄器操作是非同步的，不會阻塞主要流程
- 檔案 I/O 錯誤不會影響 AI 系統的正常運作
- 定期清理舊記錄以節省磁碟空間

### 4. 除錯和監控

- 定期檢查記錄統計
- 監控錯誤記錄的頻率
- 分析決策記錄來優化 AI 邏輯

## 範例程式碼

完整的使用範例請參考：

- `src/lib/ai/ai-output-logger-example.ts` - 詳細使用範例
- `scripts/test-ai-output-logger.ts` - 測試腳本

執行測試：

```bash
npm run test:ai-logger
```

## 故障排除

### 記錄檔案無法建立

- 檢查目錄權限
- 確保有足夠的磁碟空間
- 檢查檔案路徑是否正確

### 記錄內容遺失

- 確認 `enableRotation` 設定
- 檢查 `maxFileSize` 配置
- 驗證檔案輪轉邏輯

### 效能問題

- 調整 `maxFileSize` 大小
- 啟用檔案輪轉
- 定期清理舊記錄

## 版本歷史

- **v1.0.0** - 初始版本，支援基本記錄功能
- 支援四種記錄類型（OUTPUT、DECISION、ERROR、SYSTEM）
- 支援檔案輪轉和自動清理
- 整合到 AgentController、OpenAIService、AgentFactory
