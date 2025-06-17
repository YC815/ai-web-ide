// 🐳 Docker AI 工具統一入口
// 此文件是所有Docker AI工具的統一入口，確保所有操作都在Docker容器內執行

export {
  // 核心工具類
  DockerToolkit,
  DockerDevServerTool,
  DockerLogMonitorTool,
  DockerHealthCheckTool,
  DockerFileSystemTool,
  createDockerToolkit,
  DOCKER_TOOL_USAGE_GUIDE
} from './docker-tools';

export {
  // 管理器
  DockerAIEditorManager,
  createDockerAIEditorManager,
  createDefaultDockerContext,
  DOCKER_AI_EDITOR_SUMMARY
} from './docker-ai-editor-manager';

export {
  // 工具註冊表
  DOCKER_TOOL_REGISTRY,
  DockerToolCategory,
  DockerToolPriority,
  getDockerToolsByCategory,
  getDockerToolsByPriority,
  getDockerMVPTools,
  getDockerRecommendedTools,
  getDockerToolStatistics
} from './docker-tool-registry';

export {
  // 函數架構定義
  DOCKER_AI_FUNCTION_SCHEMAS,
  getDockerFunctionDefinitionsForOpenAI,
  getDockerFunctionDefinitionsGeneric,
  DOCKER_TOOL_SUMMARY
} from './docker-function-schemas';

// 類型導出
export type {
  DockerToolResponse,
  DockerContext,
  DevServerStatus,
  HealthCheckResponse,
  LogReadOptions
} from './docker-tools';

export type {
  DockerAIEditorConfig,
  UserConfirmationRequest,
  PendingAction
} from './docker-ai-editor-manager';

export type {
  DockerToolDefinition
} from './docker-tool-registry';

export type {
  DockerFunctionSchema,
  DockerAIToolName,
  DockerAIToolParameters,
  DockerAIToolResponses,
  DockerAIToolCall,
  DockerAIToolResponse
} from './docker-function-schemas';

// 🎯 快速開始範例
export const DOCKER_AI_QUICK_START = `
# 🐳 Docker AI 工具快速開始

## 1️⃣ 創建Docker工具實例

\`\`\`typescript
import { 
  createDockerAIEditorManager, 
  createDefaultDockerContext,
  DockerToolCategory,
  getDockerMVPTools
} from '@/lib/docker-ai-tools';

// 創建Docker上下文
const dockerContext = createDefaultDockerContext('your-container-id');

// 創建AI編輯器管理器
const dockerAI = createDockerAIEditorManager({
  dockerContext,
  enableUserConfirmation: true,
  enableActionLogging: true
});
\`\`\`

## 2️⃣ 執行基本工具

\`\`\`typescript
// 啟動容器內開發伺服器
await dockerAI.executeDockerAITool('docker_start_dev_server', {});

// 檢查容器內伺服器狀態
await dockerAI.executeDockerAITool('docker_check_dev_server_status', {});

// 讀取容器內日誌
await dockerAI.executeDockerAITool('docker_read_log_tail', { 
  lines: 1000, 
  keyword: 'Error' 
});

// 智能監控與修復
await dockerAI.executeDockerAITool('docker_smart_monitor_and_recover', {});
\`\`\`

## 3️⃣ 獲取工具清單

\`\`\`typescript
// 獲取MVP工具清單
const mvpTools = getDockerMVPTools();

// 獲取開發伺服器工具
const devServerTools = getDockerToolsByCategory(DockerToolCategory.DEV_SERVER);

// 獲取OpenAI Function Calling定義
const functionDefs = dockerAI.getFunctionDefinitionsForOpenAI();
\`\`\`

## ✨ 核心原則

🔒 **完全隔離**: 所有操作都在Docker容器內執行，不會影響宿主機
🛡️ **安全第一**: 內建防爆閥、頻率限制、次數限制等安全機制
🎯 **專註專案**: 只操作容器內的專案檔案和日誌
⚡ **智能修復**: 自動偵測問題並嘗試在容器內修復
📊 **完整監控**: 提供容器內完整的狀態報告和日誌分析
`;

// 🎯 工具統計摘要
export const TOOL_STATISTICS = {
  totalTools: 14, // 手動計算的工具數量
  mvpTools: 5, // MVP工具數量
  categories: 6, // 工具分類數量
  safetyFeatures: [
    '容器內執行隔離',
    '防爆閥機制 (10秒冷卻)',
    '重啟次數限制 (最多5次)',
    '日誌讀取限制 (最大10K行)',
    '健康檢查逾時保護'
  ]
}; 