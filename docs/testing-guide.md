# 🧪 @/lib 模組測試完整指南

## 📋 概述

這份指南將幫助您獨立測試 `@/lib` 中的所有工具，確保功能正確性。我們的測試框架基於 Jest，提供全面的單元測試、整合測試和覆蓋率分析。

## 🚀 快速開始

### 1. 安裝測試依賴

```bash
npm install --save-dev jest @types/jest ts-jest jest-environment-node
```

### 2. 執行測試

```bash
# 執行完整測試套件
npm run test

# 執行特定模組測試
npm run test:core     # 核心模組
npm run test:docker   # Docker 模組
npm run test:ai       # AI 模組

# 執行覆蓋率測試
npm run test:coverage
```

### 3. 監視模式開發

```bash
# 監視檔案變更並自動重新測試
npm run test:watch
```

## 📂 測試結構

```
tests/
├── setup.ts                    # 測試環境設置
├── lib/                        # @/lib 模組測試
│   ├── core/                   # 核心模組測試
│   │   ├── logger.test.ts      # 日誌系統測試
│   │   ├── diff-processor.test.ts # Diff處理器測試
│   │   └── tool-manager.test.ts   # 工具管理器測試
│   ├── docker/                 # Docker 模組測試
│   │   ├── tools.test.ts       # Docker工具測試
│   │   ├── ai-editor-manager.test.ts # AI編輯器測試
│   │   └── config-manager.test.ts    # 配置管理測試
│   └── ai/                     # AI 模組測試
│       ├── context-manager.test.ts   # 上下文管理器測試
│       ├── prompt-builder.test.ts    # 提示詞構建器測試
│       └── openai.test.ts           # OpenAI整合測試
├── integration/                # 整合測試
│   └── lib-integration.test.ts # 模組間整合測試
└── run-tests.ts               # 自定義測試執行器
```

## 🔧 測試內容

### Core 模組

- ✅ Logger 日誌系統
- ✅ DiffProcessor Diff 處理
- ✅ ToolManager 工具管理

### Docker 模組

- ✅ Docker 工具操作
- ✅ AI 編輯器管理
- ✅ 配置管理

### AI 模組

- ✅ 上下文管理
- ✅ 提示詞構建
- ✅ OpenAI 整合

## 📊 覆蓋率目標

- 🎯 整體覆蓋率：≥ 70%
- 🎯 核心模組：≥ 80%
- 🎯 關鍵功能：≥ 90%

## 🔧 核心模組測試

### Logger 測試

```bash
npm run test -- tests/lib/core/logger.test.ts
```

**測試內容：**

- ✅ 單例模式正確性
- ✅ 日誌級別過濾
- ✅ 檔案寫入功能
- ✅ ToolLogger 工具特定日誌
- ✅ 錯誤處理機制

### DiffProcessor 測試

```bash
npm run test -- tests/lib/core/diff-processor.test.ts
```

**測試內容：**

- ✅ Unified diff 生成
- ✅ Diff 套用功能
- ✅ Diff 解析和驗證
- ✅ 統計計算
- ✅ 多種格式輸出（HTML、Markdown）

### ToolManager 測試

```bash
npm run test -- tests/lib/core/tool-manager.test.ts
```

**測試內容：**

- ✅ 工具註冊和調用
- ✅ 事件系統
- ✅ 錯誤處理和重試
- ✅ 統計追蹤
- ✅ 智能工具建議

## 🐳 Docker 模組測試

### Docker Tools 測試

```bash
npm run test -- tests/lib/docker/tools.test.ts
```

**測試內容：**

- ✅ 開發伺服器管理（啟動、重啟、狀態檢查）
- ✅ 日誌監控（讀取、搜尋、檔案列表）
- ✅ 健康檢查（服務和容器）
- ✅ 檔案系統操作（讀取、寫入）
- ✅ 智能監控和修復

### AI Editor Manager 測試

```bash
npm run test -- tests/lib/docker/ai-editor-manager.test.ts
```

**測試內容：**

- ✅ Docker AI 工具執行
- ✅ 模擬模式處理
- ✅ 用戶確認機制
- ✅ 錯誤處理和恢復

## 🤖 AI 模組測試

### Context Manager 測試

```bash
npm run test -- tests/lib/ai/context-manager.test.ts
```

**測試內容：**

- ✅ 專案快照生成
- ✅ 智能建議系統
- ✅ 快取機制
- ✅ 專案報告生成

### Prompt Builder 測試

```bash
npm run test -- tests/lib/ai/prompt-builder.test.ts
```

**測試內容：**

- ✅ 動態提示詞構建
- ✅ 上下文感知
- ✅ 意圖分析
- ✅ 工具選擇指導

## 📊 測試覆蓋率

### 查看覆蓋率報告

```bash
npm run test:coverage
```

**覆蓋率目標：**

- 🎯 整體覆蓋率：≥ 70%
- 🎯 核心模組：≥ 80%
- 🎯 關鍵功能：≥ 90%

### 覆蓋率報告位置

- 終端輸出：即時覆蓋率統計
- HTML 報告：`coverage/lcov-report/index.html`
- LCOV 檔案：`coverage/lcov.info`

## 🔍 測試策略

### 1. 單元測試

- **目標**：測試單一功能模組
- **範圍**：每個類別和函數
- **模擬**：外部依賴（Docker、檔案系統、網路）

### 2. 整合測試

- **目標**：測試模組間協作
- **範圍**：跨模組功能流程
- **真實性**：使用真實的內部介面

### 3. 模擬測試

- **Docker 命令**：模擬 `child_process.exec`
- **檔案系統**：模擬 `fs` 操作
- **網路請求**：模擬 API 調用

## 🛠️ 自定義測試執行器

### 使用方式

```bash
# 執行所有測試
npx ts-node tests/run-tests.ts

# 執行特定類別
npx ts-node tests/run-tests.ts --category core

# 執行特定套件
npx ts-node tests/run-tests.ts --suite Logger

# 只執行覆蓋率
npx ts-node tests/run-tests.ts --coverage
```

### 功能特色

- 🎨 彩色輸出和進度顯示
- 📊 詳細的測試報告
- 🏷️ 按優先級執行測試
- 📈 覆蓋率分析
- 💡 智能建議和故障排除

## 🐛 常見問題排除

### 1. Docker 相關測試失敗

```bash
# 檢查 Docker 是否運行
docker --version
docker ps

# 確保測試使用模擬模式
export NODE_ENV=test
```

### 2. 模組路徑解析問題

```bash
# 檢查 tsconfig.json 路徑映射
# 確保 jest.config.js 中的 moduleNameMapping 正確
```

### 3. 測試超時

```bash
# 增加測試超時時間
jest --testTimeout=30000
```

### 4. 覆蓋率不足

```bash
# 查看詳細覆蓋率報告
npm run test:coverage
open coverage/lcov-report/index.html
```

## 📝 測試最佳實踐

### 1. 測試命名

```typescript
describe("ModuleName", () => {
  describe("methodName", () => {
    it("應該在正常情況下成功執行", () => {
      // 測試邏輯
    });

    it("應該在錯誤情況下正確處理", () => {
      // 錯誤處理測試
    });
  });
});
```

### 2. 模擬設置

```typescript
// 在 beforeEach 中設置模擬
beforeEach(() => {
  jest.clearAllMocks();
  mockFunction.mockResolvedValue(expectedResult);
});
```

### 3. 斷言檢查

```typescript
// 使用具體的斷言
expect(result.success).toBe(true);
expect(result.data).toHaveProperty("expectedField");
expect(mockFunction).toHaveBeenCalledWith(expectedArgs);
```

## 🚀 持續整合

### GitHub Actions 設置

```yaml
name: Test @/lib modules
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
```

### 本地 Git Hooks

```bash
# 安裝 husky
npm install --save-dev husky

# 設置 pre-commit hook
npx husky add .husky/pre-commit "npm run test"
```

## 📚 進階測試技巧

### 1. 效能測試

```typescript
it("應該在合理時間內完成", async () => {
  const startTime = Date.now();
  await functionUnderTest();
  const duration = Date.now() - startTime;
  expect(duration).toBeLessThan(1000); // 1秒內完成
});
```

### 2. 記憶體洩漏檢測

```typescript
it("應該正確清理資源", async () => {
  const initialMemory = process.memoryUsage().heapUsed;
  await functionUnderTest();
  global.gc?.(); // 需要 --expose-gc 標誌
  const finalMemory = process.memoryUsage().heapUsed;
  expect(finalMemory - initialMemory).toBeLessThan(1024 * 1024); // 1MB
});
```

### 3. 並發測試

```typescript
it("應該處理並發請求", async () => {
  const promises = Array(10)
    .fill(0)
    .map(() => functionUnderTest());
  const results = await Promise.all(promises);
  expect(results.every((r) => r.success)).toBe(true);
});
```

## 🎯 測試檢查清單

在提交代碼前，請確保：

- [ ] 所有單元測試通過
- [ ] 覆蓋率達到目標（≥70%）
- [ ] 沒有測試警告或錯誤
- [ ] 新功能有對應測試
- [ ] 錯誤處理有測試覆蓋
- [ ] 模擬設置正確
- [ ] 測試執行時間合理（<30 秒）

## 🔗 相關資源

- [Jest 官方文檔](https://jestjs.io/docs/getting-started)
- [TypeScript Jest 配置](https://jestjs.io/docs/getting-started#using-typescript)
- [測試最佳實踐](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

**記住**：好的測試不僅能發現錯誤，還能作為代碼的活文檔，幫助其他開發者理解功能預期行為。
