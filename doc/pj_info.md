# 一、專案總覽

**專案名稱**：AI Web IDE（暫定）

**目標**：打造一款基於對話式交互的即時開發環境，結合 AI 編碼、任務管理、實時預覽與自動修復功能，讓使用者能通過聊天完成從初始化到部署的完整前端專案開發流程。

**範圍**：

- 左側聊天與 TODO 管理畫面
- 右側 Next.js 實時預覽與裝置模擬
- 容器化開發環境 + 自動錯誤收集回饋
- 環境變數管理（.env）
- 自動 Git Checkpoint 與回滾
- Token 及成本追蹤、Markdown 完成摘要

**MVP 核心功能**：

1. 聊天式自然語言驅動編碼 + 只讀 TODO 列表
2. Next.js React 組件實時渲染預覽（桌面／手機模式）
3. AI 自動環境檢測與錯誤修復

---

# 二、需求與功能清單

※ 所有互動流程均透過 Call Tool 機制進行，AI 與前端界面透過統一接口交換事件與數據。
※ AI 主要以 Diff 格式輸出代碼變更，前端工具負責自動套用這些 Diff。

## 2.0 首頁與容器概覽

- 主頁面以卡片形式展示所有專案，每張卡片對應一個獨立的 Docker 容器實例；卡片內容包括：

  - 專案名稱、描述、最近更新時間
  - 容器狀態指示（運行中/停止/錯誤）
  - 快速操作按鈕（啟動/停止/刪除）

- 使用者點擊專案卡片後，AI Agent 自動通過 `ContainerControlTool` 連線到對應容器，並在容器內部環境中執行後續編碼與部署任務
- 卡片列表支持過濾與搜尋功能，按狀態或關鍵字快速定位特定專案容器

## 2.1 聊天式編碼 & TODO 管理

- Tab 切換：💬 聊天、✅ TODO 列表（只讀）
- AI 自動生成 Markdown 复选框格式任務
- AI 監測並自動“打勾”已完成項目

## 2.2 即時預覽

- Next.js + React 組件渲染，無需 iframe
- 環境模式切換：開發／預覽／生產
- 設備模擬：桌面／手機，可拖拽調整寬度

## 2.3 錯誤收集與自動修復

- AI 完成當前任務後自動觸發環境檢測
- 隱藏詳細日誌，匯總錯誤列表供 AI 修復

## 2.4 容器化與環境管理

- 基礎鏡像：Node.js（含 Next.js 運行時）
- UI 引導配置：端口映射 3000:3000、卷掛載 `./src` → `/app/src`
- 環境變數寫入 `.env`

## 2.5 環境變數提醒

- AI 發出 "Call Tool" 提示需求
- 表單：Save / 不填入 → 更新 `.env` 或跳過

## 2.6 會話歷史 & Checkpoint

- AI 自動檢測重大改動（≥500 行）並執行 `git commit`
- 用户可回滾至任一 Checkpoint

## 2.7 Token & 成本統計

- 嵌入於聊天區底部，逐訊息累加顯示

## 2.8 完成摘要

- 每個功能節點完成後，AI 以 Markdown 列點式輸出摘要

## 2.9 自動部署

- AI 根據最後一個 Checkpoint，透過 `DeploymentTool` 或呼叫 GitHub Actions API，自動觸發部署流程
- 步驟：

  1. AI 生成或更新 CI/CD 配置檔（如 `.github/workflows/deploy.yml`）
  2. 呼叫 `DiffApplierTool` 套用 workflow 檔變更
  3. 透過 `DeploymentTool` 執行 `git push` 至遠端主分支
  4. `DeploymentTool` 呼叫 GitHub Actions API 啟動工作流，並監控狀態
  5. 部署結果（成功/失敗）匯總後，透過 `ErrorAnalyzerTool` 分析，如失敗則觸發自動回滾或通知 AI 修復

---

# 三、技術架構

- 每個功能節點完成後，AI 以 Markdown 列點式輸出摘要

---

# 三、技術架構

```text
前端：Next.js + React + Tailwind CSS
後端：Node.js (Express) 驅動 Docker 控制與環境管理
容器：Docker Compose（前端 / 後端 / CI Runner）
部署：GitHub Actions → Vercel / AWS / DigitalOcean
```

---

# 四、用戶故事與流程示例

| 編號 | 用戶故事              | 流程要點                                                               |
| ---- | --------------------- | ---------------------------------------------------------------------- |
| 1    | 專案初始化 & 首頁骨架 | • AI 建立 Next.js 範本<br>• TODO：初始化 Git、安裝依賴、生成首頁、預覽 |
| 2    | 創建響應式導航欄      | • AI 生成 Nav 組件<br>• TODO：編寫樣式、引入 \_app.tsx、預覽           |
| 3    | 集成 Google Maps      | • AI 安裝 SDK<br>• TODO：配置 API_KEY、創建 Map 組件、渲染並預覽       |

---

# 五、專案時程與里程碑 (12 週)

| 週次     | 任務                         | 成果物                       |
| -------- | ---------------------------- | ---------------------------- |
| 1–2 週   | 需求確認 & 原型設計          | 原型稿 (Figma)、功能規格文檔 |
| 3–4 週   | 環境搭建 & MVP1: 聊天 + TODO | 最小化可運行原型             |
| 5–6 週   | MVP2: 即時預覽 + 設備模擬    | Next.js 預覽模組             |
| 7–8 週   | MVP3: 錯誤檢測 & 修復        | 自動環境檢測流程             |
| 9–10 週  | 雲端部署 & CI/CD 流水線      | GitHub Actions 配置          |
| 11–12 週 | 測試 & 上線準備              | 測試報告、最終部署           |

---

# 六、風險與應對

- **依賴 API 變更**：定期更新 SDK；切換本地模擬選項
- **性能瓶頸**：優化 Docker 构建緩存；按需加載預覽組件
- **安全風險**：`.env` 加密存儲；限制命令執行範圍

---

# 七、成功標準

1. 使用者能在 5 分鐘內從空代碼庫啟動專案並預覽首頁
2. AI 自動完成 ≥80% TODO，並正確修復 ≥90% 自動檢測錯誤
3. 部署流程無需手動干預，回滾操作可在一鍵內完成

---

# 九、AI 使用的 Tools

本專案中，AI 將透過以下 Call Tool 接口與系統互動，所有功能均以工具化形式暴露：

| 工具名稱                 | 職責描述                                                     |
| ------------------------ | ------------------------------------------------------------ |
| **DiffApplierTool**      | 接收 AI 輸出的 diff 並套用至代碼庫                           |
| **ScriptExecutorTool**   | 在容器中執行 Shell 腳本（如 `npm install`、`npm run build`） |
| **ContainerControlTool** | 啟動、停止、重啟 Docker 容器，並監控容器狀態                 |
| **EnvVarManagerTool**    | 讀取、寫入及驗證 `.env` 變數                                 |
| **GitCheckpointTool**    | 自動提交、建立及回滾 Git Checkpoint                          |
| **ErrorAnalyzerTool**    | 收集執行時日誌與錯誤，並匯總給 AI 生成修復方案               |
| **PreviewRenderTool**    | 控制 Next.js 預覽服務，並觸發 UI 更新                        |
| **DeviceSimulatorTool**  | 切換桌面／手機模式，調整模擬寬度                             |
| **TokenCostTrackerTool** | 計算並回報每條消息的 Token 消耗與成本                        |
| **SummaryGeneratorTool** | 生成 Markdown 格式的完成摘要                                 |
| **CallToolInterface**    | 統一的事件與數據交換總線，用於所有工具呼叫                   |

---

## 八、需求優先級

### 高優先級（MVP 必備）

1. 聊天式編碼 & TODO 管理
2. 即時預覽（React 渲染 + 設備模擬）
3. DiffApplierTool、CallToolInterface 整合

### 中優先級

4. 錯誤收集與自動修復
5. 環境變數管理（EnvVarManagerTool）
6. Git Checkpoint（GitCheckpointTool）

### 低優先級

7. Token & 成本統計（TokenCostTrackerTool）
8. 完成摘要（SummaryGeneratorTool）
9. 容器控制與設備模擬擴展（ContainerControlTool、DeviceSimulatorTool）

---

## 九、下一步

1. 確認並鎖定 MVP 範圍與優先級
2. 啟動原型設計並準備基礎容器環境
3. 安排 Sprint 1 任務分派與 Kick-off 會議

---

_以上為完整專案策劃草案，請審閱並提出修改或補充。_
