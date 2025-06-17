// Docker AI 工具註冊表
// 此文件定義所有可供 AI Agent 在 Docker 容器內使用的工具清單與規格

/**
 * Docker工具分類定義
 */
export enum DockerToolCategory {
  DEV_SERVER = 'dev_server',       // Docker容器內開發伺服器管理
  LOG_MONITOR = 'log_monitor',     // Docker容器內日誌監控
  HEALTH_CHECK = 'health_check',   // Docker容器健康檢查
  FILE_SYSTEM = 'file_system',     // Docker容器內檔案系統
  CONTAINER = 'container',         // Docker容器管理
  SMART = 'smart'                  // 智能功能
}

/**
 * 工具優先級定義
 */
export enum DockerToolPriority {
  CRITICAL = 'critical',    // 核心功能，MVP必須
  HIGH = 'high',           // 高優先級，強烈建議
  MEDIUM = 'medium',       // 中優先級，建議使用
  LOW = 'low'              // 低優先級，可選功能
}

/**
 * Docker工具定義介面
 */
export interface DockerToolDefinition {
  name: string;
  displayName: string;
  category: DockerToolCategory;
  priority: DockerToolPriority;
  description: string;
  usage: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  example: string;
  risks?: string[];
  containerRequirements?: string[];
}

/**
 * Docker完整工具註冊表
 */
export const DOCKER_TOOL_REGISTRY: Record<string, DockerToolDefinition> = {
  // ====== Docker容器內開發伺服器管理工具 ======
  'docker_start_dev_server': {
    name: 'docker_start_dev_server',
    displayName: '在Docker容器內啟動開發伺服器',
    category: DockerToolCategory.DEV_SERVER,
    priority: DockerToolPriority.CRITICAL,
    description: '在Docker容器內執行 npm run dev，並將 log 重導向到容器內的 /app/logs/dev.log',
    usage: '初次開啟專案、或 AI 偵測容器內服務未運行時啟動',
    inputSchema: {},
    outputSchema: {
      success: 'boolean',
      message: 'string',
      containerOutput: 'string',
      error: 'string?'
    },
    example: `
const result = await dockerToolkit.devServer.startDevServer();
if (result.success) {
  console.log('Docker容器內開發伺服器啟動成功');
}
    `,
    containerRequirements: [
      '容器內必須有 Node.js 環境',
      '容器內必須有 /app 工作目錄', 
      '容器內必須有 /app/logs 目錄'
    ]
  },

  'docker_restart_dev_server': {
    name: 'docker_restart_dev_server',
    displayName: '在Docker容器內重啟開發伺服器',
    category: DockerToolCategory.DEV_SERVER,
    priority: DockerToolPriority.CRITICAL,
    description: '在Docker容器內 kill dev process 並重新執行 npm run dev，內建防爆閥機制',
    usage: 'AI 偵測容器內錯誤、或容器內 log 出現錯誤字串時自動修復',
    inputSchema: {
      reason: 'string?' // 重啟原因
    },
    outputSchema: {
      success: 'boolean',
      message: 'string',
      containerOutput: 'string',
      error: 'string?'
    },
    example: `
const result = await dockerToolkit.devServer.restartDevServer('修復容器內錯誤');
    `,
    risks: [
      '頻率限制：10秒內不可重啟超過一次',
      '次數限制：連續重啟不可超過5次',
      '只影響Docker容器內的服務，不會影響宿主機'
    ]
  },

  'docker_kill_dev_server': {
    name: 'docker_kill_dev_server',
    displayName: '終止Docker容器內開發伺服器',
    category: DockerToolCategory.DEV_SERVER,
    priority: DockerToolPriority.MEDIUM,
    description: '允許 AI 終止Docker容器內的 dev server，用於處理容器內資源問題',
    usage: '僅在容器內服務佔用過多記憶體或死鎖情況下使用',
    inputSchema: {},
    outputSchema: {
      success: 'boolean',
      message: 'string',
      containerOutput: 'string',
      error: 'string?'
    },
    example: `
const result = await dockerToolkit.devServer.killDevServer();
    `,
    risks: [
      '會停止容器內的開發環境',
      '需要重新啟動容器內服務'
    ]
  },

  'docker_check_dev_server_status': {
    name: 'docker_check_dev_server_status',
    displayName: '檢查Docker容器內開發伺服器狀態',
    category: DockerToolCategory.DEV_SERVER,
    priority: DockerToolPriority.HIGH,
    description: '獲取Docker容器內開發伺服器運行狀態，包含PID、端口等資訊',
    usage: '定期檢查容器內伺服器狀態，或在執行其他操作前確認狀態',
    inputSchema: {},
    outputSchema: {
      success: 'boolean',
      data: {
        isRunning: 'boolean',
        pid: 'string?',
        port: 'string?'
      },
      message: 'string',
      containerOutput: 'string'
    },
    example: `
const status = await dockerToolkit.devServer.checkDevServerStatus();
console.log(\`容器內伺服器運行中: \${status.data?.isRunning}\`);
    `
  },

  // ====== Docker容器內日誌監控工具 ======
  'docker_read_log_tail': {
    name: 'docker_read_log_tail',
    displayName: '讀取Docker容器內最近日誌',
    category: DockerToolCategory.LOG_MONITOR,
    priority: DockerToolPriority.CRITICAL,
    description: '讀取Docker容器內 /app/logs 目錄的 log 檔案最後 N 行內容，支援關鍵字搜尋',
    usage: '分析容器內錯誤、監控容器內應用程式狀態、追蹤問題',
    inputSchema: {
      lines: 'number?',     // 預設3000行，最大10000行
      logFile: 'string?',   // 預設dev.log
      keyword: 'string?'    // 關鍵字搜尋
    },
    outputSchema: {
      success: 'boolean',
      data: 'string[]',
      message: 'string',
      containerOutput: 'string',
      error: 'string?'
    },
    example: `
// 讀取容器內最近1000行錯誤日誌
const errorLogs = await dockerToolkit.logMonitor.readLogTail({
  lines: 1000,
  keyword: 'Error'
});
    `,
    risks: [
      '單次最多讀取10,000行避免記憶體溢出',
      '僅讀取容器內 /app/logs 目錄的檔案'
    ]
  },

  'docker_search_error_logs': {
    name: 'docker_search_error_logs',
    displayName: '搜尋Docker容器內錯誤日誌',
    category: DockerToolCategory.LOG_MONITOR,
    priority: DockerToolPriority.HIGH,
    description: '專門搜尋Docker容器內日誌中的錯誤訊息，是 docker_read_log_tail 的快捷方式',
    usage: '快速定位容器內系統錯誤，自動修復時的問題診斷',
    inputSchema: {
      keyword: 'string?',   // 錯誤關鍵字，預設'Error'
      lines: 'number?'      // 搜尋範圍，預設1000行
    },
    outputSchema: {
      success: 'boolean',
      data: 'string[]',
      message: 'string',
      containerOutput: 'string'
    },
    example: `
const errors = await dockerToolkit.logMonitor.searchErrorLogs('TypeError');
    `
  },

  'docker_get_log_files': {
    name: 'docker_get_log_files',
    displayName: '獲取Docker容器內日誌檔案清單',
    category: DockerToolCategory.LOG_MONITOR,
    priority: DockerToolPriority.MEDIUM,
    description: '列出Docker容器內 /app/logs 目錄中所有可用的日誌檔案',
    usage: '了解容器內有哪些日誌檔案可供分析',
    inputSchema: {},
    outputSchema: {
      success: 'boolean',
      data: 'string[]',
      message: 'string',
      containerOutput: 'string'
    },
    example: `
const logFiles = await dockerToolkit.logMonitor.getLogFiles();
    `
  },

  // ====== Docker容器健康檢查工具 ======
  'docker_check_health': {
    name: 'docker_check_health',
    displayName: 'Docker容器健康檢查',
    category: DockerToolCategory.HEALTH_CHECK,
    priority: DockerToolPriority.CRITICAL,
    description: '檢查Docker容器本身及容器內服務的健康狀態，預設檢查容器內 3000 端口',
    usage: '定期自動檢查容器及容器內 dev server 是否正常運行',
    inputSchema: {
      port: 'number?' // 預設 3000
    },
    outputSchema: {
      success: 'boolean',
      data: {
        status: 'up | down',
        responseTimeMs: 'number',
        containerHealth: 'healthy | unhealthy | starting'
      },
      message: 'string',
      containerOutput: 'string'
    },
    example: `
const health = await dockerToolkit.healthCheck.checkHealth(3000);
if (health.data?.status === 'down') {
  // 自動觸發容器內重啟
  await dockerToolkit.devServer.restartDevServer('健康檢查失敗');
}
    `
  },

  'docker_check_container_health': {
    name: 'docker_check_container_health',
    displayName: '檢查Docker容器本身健康狀態',
    category: DockerToolCategory.HEALTH_CHECK,
    priority: DockerToolPriority.HIGH,
    description: '檢查Docker容器本身的運行狀態和健康狀況',
    usage: '確保容器正常運行，作為其他操作的前提條件',
    inputSchema: {},
    outputSchema: {
      success: 'boolean',
      message: 'string',
      containerOutput: 'string'
    },
    example: `
const containerHealth = await dockerToolkit.healthCheck.checkContainerHealth();
    `
  },

  // ====== Docker容器內檔案系統工具 ======
  'docker_read_file': {
    name: 'docker_read_file',
    displayName: '讀取Docker容器內檔案',
    category: DockerToolCategory.FILE_SYSTEM,
    priority: DockerToolPriority.HIGH,
    description: '讀取Docker容器內 /app 目錄中指定檔案的內容',
    usage: '分析容器內代碼、讀取容器內配置檔案、檢查容器內檔案內容',
    inputSchema: {
      filePath: 'string' // 相對於 /app 的路徑
    },
    outputSchema: {
      success: 'boolean',
      data: 'string',
      message: 'string',
      error: 'string?'
    },
    example: `
const content = await dockerToolkit.fileSystem.readFile('src/app/page.tsx');
    `,
    containerRequirements: [
      '檔案路徑限制在容器內 /app 目錄內'
    ]
  },

  'docker_write_file': {
    name: 'docker_write_file',
    displayName: '寫入檔案到Docker容器內',
    category: DockerToolCategory.FILE_SYSTEM,
    priority: DockerToolPriority.HIGH,
    description: '寫入內容到Docker容器內 /app 目錄中的指定檔案',
    usage: '修改容器內代碼、更新容器內配置、創建容器內新內容',
    inputSchema: {
      filePath: 'string', // 相對於 /app 的路徑
      content: 'string'
    },
    outputSchema: {
      success: 'boolean',
      message: 'string',
      containerOutput: 'string',
      error: 'string?'
    },
    example: `
await dockerToolkit.fileSystem.writeFile('src/components/Button.tsx', componentCode);
    `,
    containerRequirements: [
      '檔案路徑限制在容器內 /app 目錄內',
      '容器內目錄必須有寫入權限'
    ]
  },

  'docker_list_directory': {
    name: 'docker_list_directory',
    displayName: '列出Docker容器內目錄內容',
    category: DockerToolCategory.FILE_SYSTEM,
    priority: DockerToolPriority.HIGH,
    description: '列出Docker容器內指定目錄的內容，支援遞迴列出、隱藏檔案顯示和樹狀結構',
    usage: '查看容器內專案結構、瀏覽容器內檔案、了解容器內目錄組織',
    inputSchema: {
      dirPath: 'string?', // 相對於 /app 的路徑，預設為當前目錄
      recursive: 'boolean?', // 是否遞迴列出
      showHidden: 'boolean?', // 是否顯示隱藏檔案
      useTree: 'boolean?' // 是否使用tree命令
    },
    outputSchema: {
      success: 'boolean',
      data: 'string[]',
      message: 'string',
      containerOutput: 'string',
      error: 'string?'
    },
    example: `
// 列出當前目錄
const files = await dockerToolkit.fileSystem.listDirectory();

// 遞迴列出src目錄
const srcFiles = await dockerToolkit.fileSystem.listDirectory('src', { recursive: true });

// 使用tree命令顯示結構
const treeView = await dockerToolkit.fileSystem.listDirectory('.', { useTree: true });
    `,
    containerRequirements: [
      '目錄路徑限制在容器內 /app 目錄內',
      '自動安裝tree命令如果不存在'
    ]
  },

  'docker_show_directory_tree': {
    name: 'docker_show_directory_tree',
    displayName: 'Docker容器內目錄樹狀結構',
    category: DockerToolCategory.FILE_SYSTEM,
    priority: DockerToolPriority.MEDIUM,
    description: '使用tree命令顯示Docker容器內目錄的樹狀結構，自動安裝tree如果不存在',
    usage: '快速查看容器內專案結構、可視化容器內目錄層次、專案概覽',
    inputSchema: {
      dirPath: 'string?', // 相對於 /app 的路徑，預設為當前目錄
      maxDepth: 'number?' // 最大顯示深度
    },
    outputSchema: {
      success: 'boolean',
      data: 'string',
      message: 'string',
      containerOutput: 'string',
      error: 'string?'
    },
    example: `
// 顯示當前目錄樹狀結構
const tree = await dockerToolkit.fileSystem.showDirectoryTree();

// 限制深度為2層的src目錄結構
const srcTree = await dockerToolkit.fileSystem.showDirectoryTree('src', 2);
    `,
    containerRequirements: [
      '目錄路徑限制在容器內 /app 目錄內',
      '自動安裝tree命令如果不存在'
    ]
  },

  // ====== 智能功能工具 ======
  'docker_smart_monitor_and_recover': {
    name: 'docker_smart_monitor_and_recover',
    displayName: 'Docker容器內智能監控修復',
    category: DockerToolCategory.SMART,
    priority: DockerToolPriority.CRITICAL,
    description: '在Docker容器內自動偵測問題並嘗試修復：容器健康檢查 → 分析容器內日誌 → 容器內自動重啟 → 驗證修復',
    usage: '主動式問題偵測與自動修復，完全在容器內執行，不影響宿主機',
    inputSchema: {},
    outputSchema: {
      success: 'boolean',
      data: 'string[]', // 執行步驟記錄
      message: 'string',
      error: 'string?'
    },
    example: `
// AI 在容器內自動診斷並修復問題
const recovery = await dockerToolkit.smartMonitorAndRecover();
console.log('容器內修復步驟:', recovery.data);
    `
  },

  'docker_get_full_status_report': {
    name: 'docker_get_full_status_report',
    displayName: 'Docker容器完整狀態報告',
    category: DockerToolCategory.SMART,
    priority: DockerToolPriority.HIGH,
    description: '一鍵獲取Docker容器本身健康狀態、容器內開發伺服器狀態、容器內服務健康狀態、容器內近期日誌的完整報告',
    usage: '系統總覽，快速了解Docker容器及容器內專案整體狀況',
    inputSchema: {},
    outputSchema: {
      success: 'boolean',
      data: {
        containerHealth: 'any',
        devServerStatus: 'any',
        serviceHealth: 'any',
        recentLogs: 'string[]'
      },
      message: 'string',
      error: 'string?'
    },
    example: `
const report = await dockerToolkit.getFullStatusReport();
console.log('Docker容器狀態:', report.data);
    `
  }
};

/**
 * 根據分類獲取Docker工具清單
 */
export function getDockerToolsByCategory(category: DockerToolCategory): DockerToolDefinition[] {
  return Object.values(DOCKER_TOOL_REGISTRY).filter(tool => tool.category === category);
}

/**
 * 根據優先級獲取Docker工具清單
 */
export function getDockerToolsByPriority(priority: DockerToolPriority): DockerToolDefinition[] {
  return Object.values(DOCKER_TOOL_REGISTRY).filter(tool => tool.priority === priority);
}

/**
 * 獲取Docker MVP最小可行產品工具集
 */
export function getDockerMVPTools(): DockerToolDefinition[] {
  return getDockerToolsByPriority(DockerToolPriority.CRITICAL);
}

/**
 * 獲取Docker推薦工具集（CRITICAL + HIGH）
 */
export function getDockerRecommendedTools(): DockerToolDefinition[] {
  return Object.values(DOCKER_TOOL_REGISTRY).filter(tool => 
    tool.priority === DockerToolPriority.CRITICAL || tool.priority === DockerToolPriority.HIGH
  );
}

/**
 * Docker工具使用統計
 */
export function getDockerToolStatistics() {
  const tools = Object.values(DOCKER_TOOL_REGISTRY);
  
  return {
    total: tools.length,
    byCategory: Object.values(DockerToolCategory).map(category => ({
      category,
      count: getDockerToolsByCategory(category).length
    })),
    byPriority: Object.values(DockerToolPriority).map(priority => ({
      priority,
      count: getDockerToolsByPriority(priority).length
    })),
    mvpCount: getDockerMVPTools().length,
    recommendedCount: getDockerRecommendedTools().length
  };
}

// Docker工具清單摘要
export const DOCKER_TOOL_SUMMARY = `
# 🐳 Docker AI 工具集摘要報告

## 📊 統計資訊
- **總工具數量**: ${Object.keys(DOCKER_TOOL_REGISTRY).length}
- **MVP核心工具**: ${getDockerMVPTools().length} 個
- **推薦工具集**: ${getDockerRecommendedTools().length} 個

## 🎯 MVP 核心工具 (${getDockerMVPTools().length}/5)
${getDockerMVPTools().map(tool => `- ✅ **${tool.displayName}**: ${tool.description}`).join('\n')}

## 📋 完整工具分類

### 🔧 Docker容器內開發伺服器管理 (${getDockerToolsByCategory(DockerToolCategory.DEV_SERVER).length} 個)
${getDockerToolsByCategory(DockerToolCategory.DEV_SERVER).map(tool => `- **${tool.displayName}**: ${tool.description}`).join('\n')}

### 📝 Docker容器內日誌監控 (${getDockerToolsByCategory(DockerToolCategory.LOG_MONITOR).length} 個)
${getDockerToolsByCategory(DockerToolCategory.LOG_MONITOR).map(tool => `- **${tool.displayName}**: ${tool.description}`).join('\n')}

### 🏥 Docker容器健康檢查 (${getDockerToolsByCategory(DockerToolCategory.HEALTH_CHECK).length} 個)
${getDockerToolsByCategory(DockerToolCategory.HEALTH_CHECK).map(tool => `- **${tool.displayName}**: ${tool.description}`).join('\n')}

### 📁 Docker容器內檔案系統 (${getDockerToolsByCategory(DockerToolCategory.FILE_SYSTEM).length} 個)
${getDockerToolsByCategory(DockerToolCategory.FILE_SYSTEM).map(tool => `- **${tool.displayName}**: ${tool.description}`).join('\n')}

### 🤖 智能功能 (${getDockerToolsByCategory(DockerToolCategory.SMART).length} 個)
${getDockerToolsByCategory(DockerToolCategory.SMART).map(tool => `- **${tool.displayName}**: ${tool.description}`).join('\n')}

## ⚡ 主要特色

### 🐳 Docker 隔離保證
- **完全隔離**: 所有操作都在Docker容器內執行
- **路徑限制**: 檔案操作限制在容器內 /app 目錄
- **日誌隔離**: 日誌存儲在容器內 /app/logs 目錄
- **服務隔離**: 開發伺服器運行在容器內的 3000 端口
- **宿主機保護**: 絕不影響宿主機的任何檔案或服務

### 🛡️ 安全機制
- 重啟頻率限制：10秒冷卻時間
- 重啟次數上限：最多5次連續重啟
- 日誌讀取限制：單次最大10,000行
- 健康檢查逾時：預設5秒保護
- 容器狀態檢查：確保容器運行正常

### 🎯 設計原則
- **容器優先**: 所有操作通過 docker exec 執行
- **主動監控**: 自動偵測容器內問題並嘗試修復
- **防爆設計**: 內建多重安全機制避免容器過載
- **智能診斷**: 結合容器健康檢查、容器內日誌分析、容器內自動修復
- **狀態透明**: 完整的容器狀態報告與執行記錄

### 🚀 使用建議
1. 優先使用 \`docker_smart_monitor_and_recover()\` 進行主動式維護
2. 定期執行 \`docker_get_full_status_report()\` 了解容器狀況
3. 重啟失敗時使用 \`docker_search_error_logs()\` 分析原因
4. 善用 \`docker_check_health()\` 驗證修復效果
5. 所有檔案操作都在容器內 /app 目錄進行

### 🔧 容器需求
- Docker 容器必須正在運行
- 容器內必須有 Node.js 環境
- 容器內必須掛載 /app 工作目錄
- 容器內建議創建 /app/logs 日誌目錄
- 容器內應該暴露 3000 端口給宿主機
`; 