# 🐳 Docker AI 工具架構說明

## 📁 重構後的文件架構

```
src/lib/
├── docker-ai-tools.ts               # 🎯 統一入口文件
├── docker-tools.ts                  # 🔧 Docker容器內核心工具實現
├── docker-ai-editor-manager.ts      # 🎮 AI編輯器管理器
├── docker-function-schemas.ts       # 📋 Function Calling Schema定義
├── docker-tool-registry.ts          # 📚 工具註冊表和定義
└── README-Docker-AI-Tools.md        # 📖 此說明文檔
```

## 🎯 文件功能說明

### 1. `docker-ai-tools.ts` - 統一入口

- **用途**: 所有 Docker AI 工具的統一導出入口
- **特色**:
  - 整合所有 Docker 工具模組
  - 提供完整的類型定義導出
  - 包含快速開始範例
  - 工具統計摘要

### 2. `docker-tools.ts` - 核心工具實現

- **用途**: Docker 容器內各種工具的具體實現
- **包含**:
  - `DockerDevServerTool` - 容器內開發伺服器管理
  - `DockerLogMonitorTool` - 容器內日誌監控
  - `DockerHealthCheckTool` - 容器健康檢查
  - `DockerFileSystemTool` - 容器內檔案系統操作
  - `DockerToolkit` - 工具整合類

### 3. `docker-ai-editor-manager.ts` - AI 編輯器管理器

- **用途**: 統一管理和執行 Docker AI 工具
- **特色**:
  - 工具調用路由
  - 用戶確認機制
  - 執行日誌記錄
  - 錯誤處理和回饋

### 4. `docker-function-schemas.ts` - Function Schema

- **用途**: 定義 AI Function Calling 的結構和參數
- **支援**:
  - OpenAI Function Calling 格式
  - 通用 Function 格式
  - 完整的參數和回應類型定義

### 5. `docker-tool-registry.ts` - 工具註冊表

- **用途**: 工具定義、分類和管理
- **功能**:
  - 工具分類管理
  - 優先級定義
  - 使用範例和風險說明
  - MVP 工具篩選

## 🚀 快速使用

### 基本設置

```typescript
import {
  createDockerAIEditorManager,
  createDefaultDockerContext,
} from "@/lib/docker-ai-tools";

// 創建Docker上下文
const dockerContext = createDefaultDockerContext("container-id");

// 創建AI管理器
const dockerAI = createDockerAIEditorManager({
  dockerContext,
  enableUserConfirmation: true,
  enableActionLogging: true,
});
```

### 執行工具

```typescript
// 啟動容器內開發伺服器
const result = await dockerAI.executeDockerAITool(
  "docker_start_dev_server",
  {}
);

// 讀取容器內日誌
const logs = await dockerAI.executeDockerAITool("docker_read_log_tail", {
  lines: 1000,
  keyword: "Error",
});

// 智能監控與修復
const recovery = await dockerAI.executeDockerAITool(
  "docker_smart_monitor_and_recover",
  {}
);
```

## 🔒 安全保證

### 完全隔離

- ✅ 所有操作通過 `docker exec` 在容器內執行
- ✅ 檔案操作限制在容器內 `/app` 目錄
- ✅ 日誌存儲在容器內 `/app/logs` 目錄
- ✅ 開發伺服器運行在容器內 3000 端口
- ✅ **絕對不會影響宿主機任何檔案或服務**

### 防護機制

- 🛡️ 重啟頻率限制：10 秒冷卻時間
- 🛡️ 重啟次數上限：最多 5 次連續重啟
- 🛡️ 日誌讀取限制：單次最大 10,000 行
- 🛡️ 健康檢查逾時：預設 5 秒保護

## 🎯 MVP 工具集（5 個核心工具）

1. **`docker_start_dev_server`** - 容器內啟動開發伺服器
2. **`docker_restart_dev_server`** - 容器內重啟開發伺服器
3. **`docker_read_log_tail`** - 讀取容器內日誌
4. **`docker_check_health`** - 容器健康檢查
5. **`docker_smart_monitor_and_recover`** - 智能監控修復

## 📊 工具分類

### 🖥️ 開發伺服器管理

- `docker_start_dev_server`
- `docker_restart_dev_server`
- `docker_kill_dev_server`
- `docker_check_dev_server_status`

### 📄 日誌監控

- `docker_read_log_tail`
- `docker_search_error_logs`
- `docker_get_log_files`

### ❤️ 健康檢查

- `docker_check_health`
- `docker_check_container_health`

### 📁 檔案系統

- `docker_read_file`
- `docker_write_file`
- `docker_list_directory`
- `docker_show_directory_tree`

### 🤖 智能功能

- `docker_smart_monitor_and_recover`
- `docker_get_full_status_report`

## 🔗 與其他系統整合

### OpenAI Integration

```typescript
// 獲取Function Calling定義
const functionDefs = dockerAI.getFunctionDefinitionsForOpenAI();

// 在OpenAI API中使用
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "請檢查容器內開發伺服器狀態" }],
  functions: functionDefs,
});
```

### 工具統計

```typescript
import {
  getDockerToolStatistics,
  getDockerMVPTools,
} from "@/lib/docker-ai-tools";

// 獲取完整統計
const stats = getDockerToolStatistics();

// 獲取MVP工具
const mvpTools = getDockerMVPTools();
```

## ❌ 已刪除的危險文件

為確保安全性，以下可能污染宿主機環境的文件已被刪除：

- ~~`ai-tools.ts`~~ - 可能操作宿主機的工具
- ~~`ai-editor-tools.ts`~~ - 非 Docker 編輯器工具
- ~~`ai-function-schemas.ts`~~ - 非 Docker 功能 schemas
- ~~`ai-editor-manager.ts`~~ - 非 Docker 編輯器管理器
- ~~`tool-registry.ts`~~ - 非 Docker 工具註冊器
- ~~`ai-system-tools.ts`~~ - 系統工具（可能危險）

## 💡 最佳實踐

1. **始終使用 Docker 工具**: 確保所有操作都在容器內進行
2. **監控資源使用**: 定期檢查容器健康狀態
3. **智能修復優先**: 使用 `docker_smart_monitor_and_recover` 自動處理問題
4. **日誌分析**: 定期讀取容器內日誌以預防問題
5. **安全第一**: 遵循所有內建的安全限制和防護機制

## 🛠️ 開發者註記

- 所有工具都經過 linter 檢查，無類型錯誤
- 完整的 TypeScript 類型支援
- 內建詳細的錯誤處理和日誌記錄
- 支援用戶確認機制（可選）
- 提供完整的使用範例和說明文檔
