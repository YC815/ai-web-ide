# 🤖 AI Web IDE

> 基於對話式交互的即時開發環境，結合 AI 編碼、任務管理、實時預覽與自動修復功能

## 📋 專案概覽

AI Web IDE 是一款創新的網頁開發工具，讓開發者能夠通過自然語言對話來完成從初始化到部署的完整前端專案開發流程。

### 🎯 核心特色

- **💬 聊天式編碼**: 使用自然語言指令驅動程式開發
- **📋 智能 TODO 管理**: AI 自動生成和追蹤開發任務
- **👁️ 實時預覽**: 支援多設備響應式預覽，即時看到變更效果
- **🔧 自動錯誤修復**: 智能檢測和修復程式錯誤
- **🐳 容器化環境**: 完整的 Docker 開發環境
- **⚡ Git 自動檢查點**: 智能版本控制和回滾功能
- **💰 Token 成本追蹤**: 即時追蹤 AI 使用成本

## 🏗️ 系統架構

```
AI Web IDE
├── 前端 (Next.js + React + Tailwind CSS)
│   ├── 聊天介面 (ChatInterface)
│   ├── TODO 管理 (TodoList)
│   ├── 實時預覽 (PreviewPanel)
│   └── 工具管理 (ToolManager)
├── 後端 (Node.js + Express)
│   ├── Docker 容器控制
│   ├── 文件系統管理
│   └── AI 工具介面
├── 資料庫 (PostgreSQL + Redis)
│   ├── 專案資料存儲
│   └── 會話快取管理
└── CI/CD (GitHub Actions + Docker)
    ├── 自動部署流程
    └── 容器化構建
```

## 🚀 快速開始

### 環境需求

- Node.js 18+
- Docker & Docker Compose
- Git

### 本地開發

1. **克隆專案**

   ```bash
   git clone <repository-url>
   cd ai_creator
   ```

2. **安裝依賴**

   ```bash
   npm install
   ```

3. **啟動開發服務器**

   ```bash
   npm run dev
   ```

4. **瀏覽應用**
   - 前端: http://localhost:3000
   - 健康檢查: http://localhost:3000/api/health

### Docker 容器化部署

1. **開發環境**

   ```bash
   docker-compose up -d
   ```

2. **生產環境**

   ```bash
   docker-compose --profile production up -d
   ```

3. **查看服務狀態**
   ```bash
   docker-compose ps
   ```

## 📖 功能使用指南

### 💬 聊天式編碼

1. 在左側聊天區域輸入您的需求
2. AI 會分析需求並生成相應的程式碼
3. 程式碼會自動應用到專案中
4. 右側預覽區域會即時顯示變更效果

**範例指令:**

- "建立一個響應式導航欄組件"
- "修復當前的 TypeScript 錯誤"
- "整合 Google Maps API"

### 📋 TODO 管理

- AI 會根據對話自動生成開發任務
- 任務會按優先級和類別自動分類
- 完成功能時 AI 會自動標記為已完成
- 支援任務篩選和進度追蹤

### 👁️ 實時預覽

- **設備模擬**: 桌面、平板、手機視圖
- **環境切換**: 開發、預覽、生產模式
- **即時重載**: 程式碼變更即時反映
- **錯誤顯示**: 自動收集和顯示錯誤

### 🔧 工具管理

AI Web IDE 內建多種專業工具：

- **DiffApplierTool**: 程式碼差異應用
- **ScriptExecutorTool**: 腳本執行
- **ContainerControlTool**: 容器管理
- **GitCheckpointTool**: 版本控制
- **ErrorAnalyzerTool**: 錯誤分析
- **TokenCostTrackerTool**: 成本追蹤

## 🛠️ 開發指南

### 專案結構

```
src/
├── app/                    # Next.js 應用主目錄
│   ├── components/         # React 組件
│   │   ├── ChatInterface.tsx
│   │   ├── TodoList.tsx
│   │   ├── PreviewPanel.tsx
│   │   └── MessageInput.tsx
│   ├── lib/               # 工具庫
│   │   └── tools/         # AI 工具系統
│   │       ├── types.ts
│   │       └── ToolManager.ts
│   ├── api/               # API 路由
│   │   └── health/        # 健康檢查
│   ├── globals.css        # 全局樣式
│   ├── layout.tsx         # 布局組件
│   └── page.tsx           # 主頁面
├── public/                # 靜態資源
└── docker-compose.yml     # 容器編排
```

## 🧪 測試

```bash
# 執行測試
npm test

# 執行 Lint
npm run lint

# 健康檢查測試
curl http://localhost:3000/api/health
```

## 🐳 Docker 使用

### 常用指令

```bash
# 查看日誌
docker-compose logs -f frontend

# 進入容器
docker-compose exec frontend /bin/sh

# 重建服務
docker-compose up --build frontend

# 清理資源
docker-compose down -v
```

## 🤝 貢獻指南

1. Fork 本專案
2. 建立功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交變更 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

## 📄 授權條款

本專案使用 MIT License 授權條款。

---

**開發團隊** | 基於專案報告規格建立的 AI Web IDE 解決方案
