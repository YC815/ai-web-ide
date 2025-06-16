// GPT-4 Function Calling Schema 定義
// 這個模組定義了給 AI 使用的 function 工具的 schema

export interface FunctionSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

// ✅ 給 AI 使用的核心工具 Schema
export const AI_EDITOR_FUNCTION_SCHEMAS: FunctionSchema[] = [
  {
    name: 'read_file',
    description: '讀取指定檔案的原始內容。限制在專案根目錄以下的合法路徑。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '檔案路徑，相對於專案根目錄'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'list_files',
    description: '列出指定目錄的檔案和子目錄清單，支援過濾和樹狀結構顯示',
    parameters: {
      type: 'object',
      properties: {
        dir: {
          type: 'string',
          description: '要列出的目錄路徑，預設為專案根目錄',
          default: '.'
        },
        glob: {
          type: 'string',
          description: '檔案過濾模式，如 "*.ts", "*.tsx", "*.js" 等'
        },
        showTree: {
          type: 'boolean',
          description: '是否顯示樹狀結構，true 顯示完整專案樹狀結構（排除 node_modules 等），false 只顯示當前目錄',
          default: false
        }
      },
      required: []
    }
  },
  {
    name: 'ask_user',
    description: '讓 AI 與使用者互動，如詢問「要套用這個修改嗎？」。UI 會呈現按鈕或自由輸入。',
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
  },
  {
    name: 'propose_diff',
    description: 'AI 擬定 unified diff。這是 GPT 的主要任務，用於生成代碼變更建議。',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '檔案路徑'
        },
        originalContent: {
          type: 'string',
          description: '原始檔案內容'
        },
        modifiedContent: {
          type: 'string',
          description: '修改後的檔案內容'
        },
        description: {
          type: 'string',
          description: '修改描述'
        }
      },
      required: ['filePath', 'originalContent', 'modifiedContent', 'description']
    }
  },
  {
    name: 'run_command',
    description: '執行終端指令。必須在白名單內且需要使用者確認。',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: '要執行的指令'
        },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: '指令參數（可選）'
        },
        workingDirectory: {
          type: 'string',
          description: '工作目錄（可選）'
        }
      },
      required: ['command']
    }
  },
  {
    name: 'summarize_file',
    description: '為某檔案產生功能摘要或註解。非必要但可提升上下文理解力。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '檔案路徑'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'search_code',
    description: '在整個專案中搜尋關鍵字。用於回答「這函數定義在哪裡」等問題。',
    parameters: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: '搜尋關鍵字'
        },
        filePattern: {
          type: 'string',
          description: '檔案模式（可選），如 "**/*.{ts,tsx,js,jsx}"'
        }
      },
      required: ['keyword']
    }
  }
];

// ✨ 進階工具 Schema（強化 AI 理解能力）
export const ADVANCED_AI_FUNCTION_SCHEMAS: FunctionSchema[] = [
  {
    name: 'get_project_context',
    description: '傳回專案的高層結構（routes、components、lib）。幫助 AI 快速理解大型專案。',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_git_diff',
    description: '取得尚未 commit 的差異。回答「你最近改了什麼？」',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_terminal_output',
    description: '回傳最近終端輸出。幫助 AI debug 指令結果。',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'test_file',
    description: '執行某個 test file。讓 AI 自動測試修改後效果。',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '測試檔案路徑'
        }
      },
      required: ['filePath']
    }
  }
];

// 完整的 function schema 列表
export const ALL_AI_FUNCTION_SCHEMAS: FunctionSchema[] = [
  ...AI_EDITOR_FUNCTION_SCHEMAS,
  ...ADVANCED_AI_FUNCTION_SCHEMAS
];

// 最小可用工具組（MVP 必備）
export const MVP_FUNCTION_SCHEMAS: FunctionSchema[] = [
  AI_EDITOR_FUNCTION_SCHEMAS[0], // read_file
  AI_EDITOR_FUNCTION_SCHEMAS[1], // list_files
  AI_EDITOR_FUNCTION_SCHEMAS[2], // ask_user
  AI_EDITOR_FUNCTION_SCHEMAS[4], // run_command
  AI_EDITOR_FUNCTION_SCHEMAS[6]  // search_code
];

// 工具類型定義
export type AIToolName = 
  | 'read_file'
  | 'list_files' 
  | 'ask_user'
  | 'propose_diff'
  | 'run_command'
  | 'summarize_file'
  | 'search_code'
  | 'get_project_context'
  | 'get_git_diff'
  | 'get_terminal_output'
  | 'test_file';

// 工具參數類型定義
export interface AIToolParameters {
  read_file: { path: string };
  list_files: { dir?: string; glob?: string; showTree?: boolean };
  ask_user: { prompt: string; options?: string[] };
  propose_diff: { filePath: string; originalContent: string; modifiedContent: string; description: string };
  run_command: { command: string; args?: string[]; workingDirectory?: string };
  summarize_file: { path: string };
  search_code: { keyword: string; filePattern?: string };
  get_project_context: {};
  get_git_diff: {};
  get_terminal_output: {};
  test_file: { filePath: string };
}

// 工具回應類型定義
export interface AIToolResponses {
  read_file: string;
  list_files: string[];
  ask_user: string;
  propose_diff: {
    filePath: string;
    originalContent: string;
    proposedContent: string;
    unifiedDiff: string;
    instruction: string;
  };
  run_command: { stdout: string; stderr: string };
  summarize_file: string;
  search_code: Array<{ file: string; line: number; content: string }>;
  get_project_context: {
    structure: any;
    routes: string[];
    components: string[];
    libs: string[];
  };
  get_git_diff: string;
  get_terminal_output: string[];
  test_file: { stdout: string; stderr: string; exitCode: number };
}

// 工具調用介面
export interface AIToolCall<T extends AIToolName = AIToolName> {
  name: T;
  parameters: AIToolParameters[T];
}

// 工具回應介面
export interface AIToolResponse<T extends AIToolName = AIToolName> {
  success: boolean;
  data?: AIToolResponses[T];
  error?: string;
  message?: string;
  requiresConfirmation?: boolean;
  confirmationData?: any;
}

// 用於 OpenAI API 的 function 定義格式
export function getFunctionDefinitionsForOpenAI(includeAdvanced: boolean = false): any[] {
  const schemas = includeAdvanced ? ALL_AI_FUNCTION_SCHEMAS : AI_EDITOR_FUNCTION_SCHEMAS;
  
  return schemas.map(schema => ({
    type: 'function',
    function: {
      name: schema.name,
      description: schema.description,
      parameters: schema.parameters
    }
  }));
}

// 用於其他 AI 服務的 function 定義格式
export function getFunctionDefinitionsGeneric(includeAdvanced: boolean = false): FunctionSchema[] {
  return includeAdvanced ? ALL_AI_FUNCTION_SCHEMAS : AI_EDITOR_FUNCTION_SCHEMAS;
} 