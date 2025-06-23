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
          type: ['string', 'null'],
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
          type: ['number', 'null'],
          description: '讀取行數，預設3000行，最大10000行',
          default: 3000
        },
        logFile: {
          type: ['string', 'null'],
          description: '日誌檔案名稱，預設dev.log',
          default: 'dev.log'
        },
        keyword: {
          type: ['string', 'null'],
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
          type: ['string', 'null'],
          description: '錯誤關鍵字，預設為"Error"',
          default: 'Error'
        },
        lines: {
          type: ['number', 'null'],
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
          type: ['number', 'null'],
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
    name: 'docker_list_directory',
    description: '列出Docker容器內指定目錄的內容，支援遞迴列出和隱藏檔案顯示（注意：tree功能已禁用）',
    parameters: {
      type: 'object',
      properties: {
        dirPath: {
          type: ['string', 'null'],
          description: '目錄路徑，相對於容器內的 /app 目錄，預設為當前目錄'
        },
        recursive: {
          type: ['boolean', 'null'],
          description: '是否遞迴列出子目錄內容'
        },
        showHidden: {
          type: ['boolean', 'null'],
          description: '是否顯示隱藏檔案（以.開頭的檔案）'
        },
        useTree: {
          type: ['boolean', 'null'],
          description: '已禁用：設為 true 會返回錯誤'
        }
      },
      required: []
    }
  },
  /*
  {
    name: 'docker_show_directory_tree',
    description: '使用tree命令顯示Docker容器內目錄的樹狀結構（已暫時禁用）',
    parameters: {
      type: 'object',
      properties: {
        dirPath: {
          type: 'string',
          description: '目錄路徑，相對於容器內的 /app 目錄，預設為當前目錄'
        },
        maxDepth: {
          type: 'number',
          description: '最大顯示深度，不指定則顯示全部'
        }
      },
      required: []
    }
  },
  */
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
          type: ['array', 'null'],
          items: {
            type: 'string'
          },
          description: '選項列表（可選）'
        }
      },
      required: ['prompt']
    }
  },
  {
    name: 'docker_ls',
    description: '列出Docker容器內目錄內容（標準Unix ls命令格式）',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '目錄路徑，相對於容器內的 /app 目錄，預設為當前目錄'
        },
        long: {
          type: 'boolean',
          description: '-l, 使用長格式顯示詳細資訊'
        },
        all: {
          type: 'boolean',
          description: '-a, 顯示隱藏檔案（以.開頭的檔案）'
        },
        recursive: {
          type: 'boolean',
          description: '-R, 遞迴列出子目錄內容'
        },
        human: {
          type: 'boolean',
          description: '-h, 以人類可讀格式顯示檔案大小'
        }
      },
      required: []
    }
  },
  {
    name: 'docker_tree',
    description: '顯示Docker容器內目錄樹狀結構（標準Unix tree命令格式）',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '目錄路徑，相對於容器內的 /app 目錄，預設為當前目錄'
        },
        depth: {
          type: 'number',
          description: '-L, 限制顯示深度層級'
        },
        all: {
          type: 'boolean',
          description: '-a, 顯示隱藏檔案和目錄'
        },
        dirOnly: {
          type: 'boolean',
          description: '-d, 只顯示目錄'
        },
        fileSize: {
          type: 'boolean',
          description: '-s, 顯示檔案大小'
        }
      },
      required: []
    }
  },
  {
    name: 'docker_pwd',
    description: '顯示Docker容器內當前工作目錄（標準Unix pwd命令格式）',
    parameters: {
      type: 'object',
      properties: {},
      required: []
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
  | 'docker_list_directory'
  | 'docker_show_directory_tree'
  | 'docker_smart_monitor_and_recover'
  | 'docker_get_full_status_report'
  | 'ask_user'
  | 'docker_ls'
  | 'docker_tree'
  | 'docker_pwd';

// 🎯 Docker工具參數類型定義
export interface DockerAIToolParameters {
  docker_start_dev_server: Record<string, never>;
  docker_restart_dev_server: { reason?: string };
  docker_kill_dev_server: Record<string, never>;
  docker_check_dev_server_status: Record<string, never>;
  docker_read_log_tail: { lines?: number; logFile?: string; keyword?: string };
  docker_search_error_logs: { keyword?: string; lines?: number };
  docker_get_log_files: Record<string, never>;
  docker_check_health: { port?: number };
  docker_check_container_health: Record<string, never>;
  docker_read_file: { filePath: string };
  docker_write_file: { filePath: string; content: string };
  docker_list_directory: { dirPath?: string; recursive?: boolean; showHidden?: boolean; useTree?: boolean };
  docker_show_directory_tree: { dirPath?: string; maxDepth?: number };
  docker_smart_monitor_and_recover: Record<string, never>;
  docker_get_full_status_report: Record<string, never>;
  ask_user: { prompt: string; options?: string[] };
  docker_ls: { path?: string; long?: boolean; all?: boolean; recursive?: boolean; human?: boolean };
  docker_tree: { path?: string; depth?: number; all?: boolean; dirOnly?: boolean; fileSize?: boolean };
  docker_pwd: Record<string, never>;
}

// 🎯 Docker工具回應類型定義
export interface DockerAIToolResponses {
  docker_start_dev_server: { message: string; url?: string; containerOutput?: string };
  docker_restart_dev_server: { message: string; url?: string; restartCount?: number; containerOutput?: string };
  docker_kill_dev_server: { message: string; containerOutput?: string };
  docker_check_dev_server_status: { isRunning: boolean; pid?: string; port?: string; url?: string; message: string };
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
  docker_list_directory: string[];
  docker_show_directory_tree: string[];
  docker_smart_monitor_and_recover: string[];
  docker_get_full_status_report: {
    containerHealth: unknown;
    devServerStatus: { isRunning: boolean; pid?: string; port?: string; url?: string };
    serviceHealth: { status: 'up' | 'down'; responseTimeMs: number; containerHealth: 'healthy' | 'unhealthy' | 'starting' };
    recentLogs: string[];
  };
  ask_user: string;
  docker_ls: string[];
  docker_tree: string[];
  docker_pwd: string;
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
    type: "function",
    function: {
      name: schema.name,
      description: schema.description,
      parameters: schema.parameters
    }
  }));
}

// 🎯 獲取通用格式的Function定義
export function getDockerFunctionDefinitionsGeneric(): DockerFunctionSchema[] {
  return DOCKER_AI_FUNCTION_SCHEMAS;
}

// 🎯 Docker函數摘要資訊
export const DOCKER_FUNCTION_SUMMARY = {
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
    fileSystem: ['docker_read_file', 'docker_write_file', 'docker_list_directory'],
    smart: ['docker_smart_monitor_and_recover', 'docker_get_full_status_report'],
    interaction: ['ask_user'],
    system: ['docker_ls', 'docker_pwd']
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