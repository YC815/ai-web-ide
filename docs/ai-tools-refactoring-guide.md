# AI 工具重構指南

## 📋 概述

本文檔說明 AI Creator 專案中 AI 工具的重構過程，包括統一日誌系統、整合 Docker 工具，以及創建架構化的工具管理系統。

## 🔄 重構內容

### 1. 統一日誌系統

#### 變更內容

- **合併重複模組**: 將 `src/lib/logger.ts` 整合到 `src/lib/core/logger.ts`
- **保留過濾功能**: 維持原有的 API 路徑過濾功能
- **向後兼容**: 支援單參數和雙參數的日誌方法

#### 新功能

```typescript
import { logger, createToolLogger } from "@/lib/core/logger";

// 全域日誌器
logger.info("系統訊息");
logger.error("錯誤訊息", error);

// 工具專用日誌器
const toolLogger = createToolLogger("MyTool");
toolLogger.logToolCall(parameters, startTime);
toolLogger.logToolResult(result, executionTime);
```

### 2. Docker 工具統一

#### 變更內容

- **新統一工具**: `src/lib/ai/tools/docker-tools-unified.ts`
- **雙模式支援**: 標準模式 (靈活) 和嚴格模式 (安全)
- **棄用舊版本**: `docker-tools.ts` 和 `docker-tools-v2.ts` 標記為已棄用

#### 使用方式

```typescript
import { UnifiedDockerTools, DockerToolsMode } from "@/lib/ai/tools";

// 創建工具實例
const dockerTools = new UnifiedDockerTools(dockerManager, {
  mode: DockerToolsMode.STRICT,
  projectName: "my-project",
  enableSecurity: true,
});

// 切換模式
dockerTools.setMode(DockerToolsMode.STANDARD);

// 使用工具
const result = await dockerTools.readFile("package.json");
```

### 3. 架構化工具管理

#### 新增組件

**工具類型定義** (`src/lib/ai/tools/tool-types.ts`)

- 統一的工具介面和類型
- 工具類別和存取等級定義
- 執行上下文和驗證結果

**工具註冊表** (`src/lib/ai/tools/tool-registry.ts`)

- 工具的註冊、查詢和執行
- 參數驗證和權限檢查
- 執行指標收集

**工具管理器** (`src/lib/ai/tools/tool-manager.ts`)

- 工具的統一管理和監控
- 性能分析和健康檢查
- 配置導入導出

#### 使用範例

```typescript
import {
  UnifiedToolManager,
  ToolCategory,
  ToolAccessLevel,
} from "@/lib/ai/tools";

// 創建管理器
const toolManager = new UnifiedToolManager();
const registry = toolManager.getRegistry();

// 註冊工具
registry.register({
  id: "my-tool",
  name: "我的工具",
  description: "工具描述",
  category: ToolCategory.UTILITY,
  accessLevel: ToolAccessLevel.PUBLIC,
  schema: {
    name: "my_tool",
    description: "工具描述",
    parameters: {
      type: "object",
      properties: {
        input: { type: "string", description: "輸入參數" },
      },
      required: ["input"],
    },
  },
  handler: async (params, context) => {
    // 工具邏輯
    return { success: true, data: "result" };
  },
});

// 執行工具
const result = await registry.execute("my-tool", { input: "test" }, context);

// 獲取統計
const summary = toolManager.getToolsSummary();
const metrics = toolManager.getAllMetrics();
```

## 📁 目錄結構變更

### 新增目錄

```
src/lib/ai/tools/
├── index.ts                    # 統一導出
├── tool-types.ts              # 類型定義
├── tool-registry.ts           # 工具註冊表
├── tool-manager.ts            # 工具管理器
└── docker-tools-unified.ts    # 統一 Docker 工具
```

### 棄用文件

- `src/lib/logger.ts` → 已刪除，使用 `src/lib/core/logger.ts`
- `src/lib/ai/docker-tools.ts` → 標記為已棄用
- `src/lib/ai/docker-tools-v2.ts` → 標記為已棄用
- `src/lib/ai/enhanced-tool-registry.ts` → 標記為已棄用
- `src/lib/ai/strict-tool-registry.ts` → 標記為已棄用

## 🔄 遷移步驟

### 1. 更新日誌導入

```typescript
// 舊方式
import { logger } from "@/lib/logger";

// 新方式
import { logger } from "@/lib/core/logger";
```

### 2. 更新 Docker 工具使用

```typescript
// 舊方式
import { DockerTools } from "@/lib/ai/docker-tools";
import { StrictDockerTools } from "@/lib/ai/docker-tools-v2";

// 新方式
import { UnifiedDockerTools, DockerToolsMode } from "@/lib/ai/tools";
```

### 3. 更新工具註冊

```typescript
// 舊方式
import { EnhancedToolRegistry } from "@/lib/ai/enhanced-tool-registry";

// 新方式
import { UnifiedToolManager } from "@/lib/ai/tools";
```

## ✨ 新功能特性

### 1. 工具指標監控

- 調用次數統計
- 成功率分析
- 執行時間追蹤
- 錯誤率監控

### 2. 權限管理

- 公開、受限、管理員三級權限
- 上下文驗證
- 參數安全檢查

### 3. 健康檢查

- 工具狀態監控
- 性能問題檢測
- 自動問題報告

### 4. 配置管理

- 工具配置導出導入
- 批量工具管理
- 動態啟用停用

## 🧪 測試指南

### 單元測試

```bash
# 測試核心模組
npm run test:core

# 測試 AI 模組
npm run test:ai

# 測試 Docker 模組
npm run test:docker
```

### 整合測試

```bash
# 執行完整測試
npm test

# 測試覆蓋率
npm run test:coverage
```

## 📊 性能優化

### 1. 日誌性能

- 智能過濾減少無用輸出
- 批量寫入提升性能
- 分級日誌控制詳細程度

### 2. 工具執行

- 參數預驗證避免無效調用
- 執行時間監控識別瓶頸
- 快取機制減少重複操作

### 3. 記憶體管理

- 定期清理未使用工具
- 指標數據適時重置
- 日誌緩衝區大小控制

## 🔮 未來規劃

### 1. 短期目標

- [ ] 完成所有舊工具的遷移
- [ ] 添加更多工具類別支援
- [ ] 完善錯誤處理機制

### 2. 中期目標

- [ ] 實現工具的熱重載
- [ ] 添加工具版本管理
- [ ] 支援分散式工具執行

### 3. 長期目標

- [ ] AI 驅動的工具推薦
- [ ] 自動化工具優化
- [ ] 跨專案工具共享

## 📞 支援與回饋

如果在遷移過程中遇到問題，請：

1. 查看本指南的相關章節
2. 檢查 TypeScript 編譯錯誤
3. 執行測試確保功能正常
4. 查看日誌輸出了解詳細錯誤

## 📝 更新日誌

### v1.0.0 (2024-01-XX)

- 初始重構完成
- 統一日誌系統
- Docker 工具整合
- 架構化工具管理

---

_本文檔將隨著重構進展持續更新_
