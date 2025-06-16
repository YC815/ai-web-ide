// Docker Function Calling Schema 定義
// 這個模組定義了給 AI 使用的 Docker 工具的 schema

export interface DockerFunctionSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

// 🐳 Docker AI 工具核心 Schema (MVP)
export const DOCKER_AI_FUNCTION_SCHEMAS: DockerFunctionSchema[] = [
  {
    name: 'docker_start_dev_server',
    description: '在Docker容器內啟動開發伺服器（npm run dev），並將log重導向到容器內的 /app/logs/dev.log',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'docker_restart_dev_server',
    description: '在Docker容器內重啟開發伺服器，內建防爆閥機制（10秒冷卻，最多5次重啟）',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: '重啟原因（可選），有助於日誌記錄和問題追蹤'
        }
      },
      required: []
    }
  },
  {
    name: 'docker_kill_dev_server',
    description: '終止Docker容器內的開發伺服器，用於處理容器內資源問題',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'docker_check_dev_server_status',
    description: '檢查Docker容器內開發伺服器的運行狀態，包含PID、端口等資訊',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'docker_read_log_tail',
    description: '讀取Docker容器內 /app/logs 目錄的日誌檔案最後 N 行內容，支援關鍵字搜尋',
    parameters: {
      type: 'object',
      properties: {
        lines: {
          type: 'number',
          description: '讀取行數，預設3000行，最大10000行',
          default: 3000
        },
        logFile: {
          type: 'string',
          description: '日誌檔案名稱，預設dev.log',
          default: 'dev.log'
        },
        keyword: {
          type: 'string',
          description: '關鍵字搜尋（可選），用於過濾特定內容'
        }
      },
      required: []
    }
  },
  {
    name: 'docker_search_error_logs',
    description: '專門搜尋Docker容器內日誌中的錯誤訊息，用於快速問題診斷',
    parameters: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: '錯誤關鍵字，預設為"Error"',
          default: 'Error'
        },
        lines: {
          type: 'number',
          description: '搜尋範圍行數，預設1000行',
          default: 1000
        }
      },
      required: []
    }
  },
  {
    name: 'docker_get_log_files',
    description: '獲取Docker容器內 /app/logs 目錄中所有可用的日誌檔案清單',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'docker_check_health',
    description: '檢查Docker容器本身及容器內服務的健康狀態，預設檢查容器內3000端口',
    parameters: {
      type: 'object',
      properties: {
        port: {
          type: 'number',
          description: '要檢查的端口號，預設3000',
          default: 3000
        }
      },
      required: []
    }
  },
  {
    name: 'docker_check_container_health',
    description: '檢查Docker容器本身的運行狀態和健康狀況',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'docker_read_file',
    description: '讀取Docker容器內 /app 目錄中指定檔案的內容',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '檔案路徑，相對於容器內的 /app 目錄'
        }
      },
      required: ['filePath']
    }
  },
  {
    name: 'docker_write_file',
    description: '寫入內容到Docker容器內 /app 目錄中的指定檔案',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '檔案路徑，相對於容器內的 /app 目錄'
        },
        content: {
          type: 'string',
          description: '要寫入的檔案內容'
        }
      },
      required: ['filePath', 'content']
    }
  },
  {
    name: 'docker_smart_monitor_and_recover',
    description: '在Docker容器內執行智能監控與自動修復：容器健康檢查 → 分析容器內日誌 → 容器內自動重啟 → 驗證修復',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'docker_get_full_status_report',
    description: '獲取Docker容器完整狀態報告，包含容器健康狀態、容器內開發伺服器狀態、容器內服務健康狀態、容器內近期日誌',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'ask_user',
    description: '讓 AI 與使用者互動，如詢問「要套用這個修改嗎？」',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: '提示訊息'
        },
        options: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: '選項列表（可選）'
        }
      },
      required: ['prompt']
    }
  }
];

// 🎯 Docker工具名稱類型定義
export type DockerAIToolName = 
  | 'docker_start_dev_server'
  | 'docker_restart_dev_server'
  | 'docker_kill_dev_server'
  | 'docker_check_dev_server_status'
  | 'docker_read_log_tail'
  | 'docker_search_error_logs'
  | 'docker_get_log_files'
  | 'docker_check_health'
  | 'docker_check_container_health'
  | 'docker_read_file'
  | 'docker_write_file'
  | 'docker_smart_monitor_and_recover'
  | 'docker_get_full_status_report'
  | 'ask_user';

// 🎯 Docker工具參數類型定義
export interface DockerAIToolParameters {
  docker_start_dev_server: {};
  docker_restart_dev_server: { reason?: string };
  docker_kill_dev_server: {};
  docker_check_dev_server_status: {};
  docker_read_log_tail: { lines?: number; logFile?: string; keyword?: string };
  docker_search_error_logs: { keyword?: string; lines?: number };
  docker_get_log_files: {};
  docker_check_health: { port?: number };
  docker_check_container_health: {};
  docker_read_file: { filePath: string };
  docker_write_file: { filePath: string; content: string };
  docker_smart_monitor_and_recover: {};
  docker_get_full_status_report: {};
  ask_user: { prompt: string; options?: string[] };
}

// 🎯 Docker工具回應類型定義
export interface DockerAIToolResponses {
  docker_start_dev_server: { message: string; containerOutput?: string };
  docker_restart_dev_server: { message: string; containerOutput?: string; restartCount?: number };
  docker_kill_dev_server: { message: string; containerOutput?: string };
  docker_check_dev_server_status: { isRunning: boolean; pid?: string; port?: string; message: string };
  docker_read_log_tail: string[];
  docker_search_error_logs: string[];
  docker_get_log_files: string[];
  docker_check_health: { 
    status: 'up' | 'down'; 
    responseTimeMs: number; 
    containerHealth: 'healthy' | 'unhealthy' | 'starting';
    message: string;
  };
  docker_check_container_health: { message: string; containerOutput?: string };
  docker_read_file: string;
  docker_write_file: { message: string; containerOutput?: string };
  docker_smart_monitor_and_recover: string[];
  docker_get_full_status_report: {
    containerHealth: unknown;
    devServerStatus: { isRunning: boolean; pid?: string; port?: string };
    serviceHealth: { status: 'up' | 'down'; responseTimeMs: number; containerHealth: 'healthy' | 'unhealthy' | 'starting' };
    recentLogs: string[];
  };
  ask_user: string;
}

// 🎯 Docker工具調用介面
export interface DockerAIToolCall<T extends DockerAIToolName = DockerAIToolName> {
  name: T;
  parameters: DockerAIToolParameters[T];
}

// 🎯 Docker工具回應介面
export interface DockerAIToolResponse<T extends DockerAIToolName = DockerAIToolName> {
  success: boolean;
  data?: DockerAIToolResponses[T];
  error?: string;
  message?: string;
  containerOutput?: string;
  requiresConfirmation?: boolean;
  confirmationData?: any;
}

// 🎯 獲取OpenAI Function Calling格式的定義
export function getDockerFunctionDefinitionsForOpenAI(): any[] {
  return DOCKER_AI_FUNCTION_SCHEMAS.map(schema => ({
    name: schema.name,
    description: schema.description,
    parameters: schema.parameters
  }));
}

// 🎯 獲取通用格式的Function定義
export function getDockerFunctionDefinitionsGeneric(): DockerFunctionSchema[] {
  return DOCKER_AI_FUNCTION_SCHEMAS;
}

// 🎯 Docker工具摘要資訊
export const DOCKER_TOOL_SUMMARY = {
  total: DOCKER_AI_FUNCTION_SCHEMAS.length,
  mvpTools: [
    'docker_start_dev_server',
    'docker_restart_dev_server', 
    'docker_read_log_tail',
    'docker_check_health',
    'docker_smart_monitor_and_recover'
  ],
  categories: {
    devServer: ['docker_start_dev_server', 'docker_restart_dev_server', 'docker_kill_dev_server', 'docker_check_dev_server_status'],
    logMonitor: ['docker_read_log_tail', 'docker_search_error_logs', 'docker_get_log_files'],
    healthCheck: ['docker_check_health', 'docker_check_container_health'],
    fileSystem: ['docker_read_file', 'docker_write_file'],
    smart: ['docker_smart_monitor_and_recover', 'docker_get_full_status_report'],
    interaction: ['ask_user']
  },
  description: `
🐳 Docker AI 工具集 - 完全在容器內操作，不影響宿主機

✅ 核心功能：
- 容器內開發伺服器管理（啟動、重啟、終止、狀態檢查）
- 容器內日誌監控（讀取、搜尋錯誤、獲取檔案清單）
- Docker容器健康檢查（容器狀態、服務狀態）
- 容器內檔案系統操作（讀取、寫入）
- 智能監控與修復（自動診斷、修復、驗證）

🔒 安全保證：
- 所有操作通過 docker exec 在容器內執行
- 檔案操作限制在容器內 /app 目錄
- 日誌存儲在容器內 /app/logs 目錄
- 開發伺服器運行在容器內3000端口
- 完全不會影響宿主機專案

🛡️ 防護機制：
- 重啟頻率限制：10秒冷卻時間
- 重啟次數上限：最多5次連續重啟
- 日誌讀取限制：單次最大10,000行
- 健康檢查逾時：預設5秒保護
`
}; 