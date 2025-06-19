/**
 * 增強的工具 Schema 系統
 * 專門設計來提高 LLM 函數調用的成功率和穩定性
 */

import { z } from 'zod';
import { Tool } from '@langchain/core/tools';

// === 基礎工具類型定義 ===
export interface EnhancedToolSchema {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  examples: ToolExample[];
  commonErrors: CommonError[];
  successPatterns: string[];
  category: ToolCategory;
}

export interface ToolExample {
  scenario: string;
  input: Record<string, any>;
  explanation: string;
  expectedOutput: string;
}

export interface CommonError {
  error: string;
  cause: string;
  solution: string;
}

export enum ToolCategory {
  FILE_OPERATIONS = 'file_operations',
  PROJECT_MANAGEMENT = 'project_management',
  DOCKER_OPERATIONS = 'docker_operations',
  UTILITY = 'utility'
}

// === 核心工具 Schema 定義 ===

/**
 * Docker 檔案讀取工具 - 明確參數定義
 * 
 * ⚠️ 重要：參數名稱必須是 filePath，不是 input
 */
export const DOCKER_READ_FILE_SCHEMA: EnhancedToolSchema = {
  name: 'docker_read_file',
  description: `🐳 讀取 Docker 容器內指定檔案的內容。

🎯 **使用時機**：
- 用戶要求查看、檢查、分析任何檔案
- 需要了解檔案當前內容以進行修改
- 用戶提到"看看"、"查看"、"讀取"等動詞

📋 **路徑格式規則**：
- ✅ 使用相對路徑：src/app/page.tsx
- ✅ 主頁檔案：src/app/page.tsx 
- ❌ 避免絕對路徑：/app/workspace/project/...
- ❌ 避免 ./ 開頭：./src/app/page.tsx

🔍 **智能檔案識別**：
- "主頁"、"首頁" → src/app/page.tsx
- "配置檔案" → package.json, next.config.js
- "樣式檔案" → globals.css, tailwind.config.js

⚠️ **參數名稱重要提醒**：
- 必須使用 "filePath" 作為參數名稱
- 不是 "input"、不是 "path"、不是 "file"`,
  
  parameters: z.object({
    filePath: z.string()
      .describe('檔案路徑（相對路徑，如：src/app/page.tsx）- 參數名稱必須是 filePath')
      .refine(path => !path.startsWith('/'), '請使用相對路徑，不要以 / 開頭')
      .refine(path => !path.startsWith('./'), '請使用相對路徑，不要以 ./ 開頭')
  }),
  
  examples: [
    {
      scenario: '用戶要求查看主頁',
      input: { filePath: 'src/app/page.tsx' },
      explanation: '主頁檔案位於 src/app/page.tsx（Next.js App Router）',
      expectedOutput: '顯示 page.tsx 的完整內容'
    },
    {
      scenario: '查看專案配置',
      input: { filePath: 'package.json' },
      explanation: '專案根目錄的 package.json 配置檔案',
      expectedOutput: '顯示 package.json 的內容和依賴資訊'
    },
    {
      scenario: '正確的參數格式示範',
      input: { filePath: 'src/components/Button.tsx' },
      explanation: '注意：參數名稱是 filePath，不是 input 或其他名稱',
      expectedOutput: '成功讀取組件檔案內容'
    }
  ],
  
  commonErrors: [
    {
      error: '參數名稱錯誤：使用了 "input" 而不是 "filePath"',
      cause: 'AI調用時傳錯了參數名稱',
      solution: '必須使用 { "filePath": "src/app/page.tsx" } 格式'
    },
    {
      error: '使用絕對路徑',
      cause: '路徑以 / 開頭，如 /app/workspace/...',
      solution: '改用相對路徑，如 src/app/page.tsx'
    },
    {
      error: '檔案不存在',
      cause: '路徑錯誤或檔案確實不存在',
      solution: '檢查路徑拼寫，或使用 docker_ls 確認檔案位置'
    }
  ],
  
  successPatterns: [
    '成功讀取檔案',
    '檔案內容如下',
    '找到檔案'
  ],
  
  category: ToolCategory.DOCKER_OPERATIONS
};

/**
 * Docker 目錄列表工具 - 明確參數定義
 * 
 * ⚠️ 重要：參數名稱必須是 path，不是 directoryPath 或 input
 */
export const DOCKER_LS_SCHEMA: EnhancedToolSchema = {
  name: 'docker_ls',
  description: `🐳 列出 Docker 容器內目錄內容（標準 Unix ls 命令）。

🎯 **使用時機**：
- 用戶詢問"有哪些檔案"、"專案結構"
- 需要了解目錄內容
- 尋找特定檔案的位置

📁 **常用目錄**：
- 根目錄：'.' 或不填（預設）
- 源碼目錄：'src'
- 應用目錄：'src/app'
- 組件目錄：'src/components'

⚠️ **參數名稱重要提醒**：
- 必須使用 "path" 作為參數名稱
- 不是 "directoryPath"、不是 "input"、不是 "dir"`,
  
  parameters: z.object({
    path: z.string()
      .describe('目錄路徑（相對路徑，預設為 "." 表示當前目錄）- 參數名稱必須是 path')
      .default('.'),
    long: z.boolean()
      .describe('-l, 使用長格式顯示詳細資訊')
      .default(false)
      .optional(),
    all: z.boolean()
      .describe('-a, 顯示隱藏檔案')
      .default(false)
      .optional()
  }),
  
  examples: [
    {
      scenario: '查看專案根目錄',
      input: { path: '.' },
      explanation: '列出專案根目錄的所有檔案和資料夾',
      expectedOutput: '顯示根目錄下的檔案列表'
    },
    {
      scenario: '查看 src 目錄',
      input: { path: 'src' },
      explanation: '列出 src 目錄下的內容',
      expectedOutput: '顯示 src 目錄的檔案結構'
    },
    {
      scenario: '使用長格式查看',
      input: { path: 'src/app', long: true },
      explanation: '注意：參數名稱是 path，不是 directoryPath 或 input',
      expectedOutput: '詳細的檔案資訊列表'
    }
  ],
  
  commonErrors: [
    {
      error: '參數名稱錯誤：使用了 "directoryPath" 或 "input" 而不是 "path"',
      cause: 'AI調用時傳錯了參數名稱',
      solution: '必須使用 { "path": "src" } 格式'
    },
    {
      error: '目錄不存在',
      cause: '指定的目錄路徑不存在',
      solution: '檢查路徑拼寫，先從根目錄開始探索'
    }
  ],
  
  successPatterns: [
    '成功列出目錄',
    '找到檔案',
    'drwxr-xr-x'
  ],
  
  category: ToolCategory.DOCKER_OPERATIONS
};

/**
 * Docker 樹狀結構工具 - 明確參數定義
 * 
 * ⚠️ 重要：參數名稱必須是 path，不是 directoryPath 或 input
 */
export const DOCKER_TREE_SCHEMA: EnhancedToolSchema = {
  name: 'docker_tree',
  description: `🐳 顯示 Docker 容器內目錄樹狀結構（標準 Unix tree 命令）。

🎯 **使用時機**：
- 用戶想要看到專案的整體結構
- 需要可視化的目錄層次結構
- 快速了解專案組織

📁 **參數說明**：
- path: 要顯示的目錄路徑（預設為當前目錄）
- depth: 限制顯示深度，避免輸出過多內容

⚠️ **參數名稱重要提醒**：
- 必須使用 "path" 作為參數名稱
- 不是 "directoryPath"、不是 "input"、不是 "dirPath"`,
  
  parameters: z.object({
    path: z.string()
      .describe('目錄路徑（相對路徑，預設為 "." 表示當前目錄）- 參數名稱必須是 path')
      .default('.'),
    depth: z.number()
      .describe('限制顯示深度層級（1-5），避免輸出過多')
      .min(1)
      .max(5)
      .default(3)
      .optional()
  }),
  
  examples: [
    {
      scenario: '查看專案樹狀結構',
      input: { path: '.' },
      explanation: '顯示當前專案的樹狀結構',
      expectedOutput: '樹狀的專案結構圖'
    },
    {
      scenario: '查看 src 目錄結構',
      input: { path: 'src', depth: 2 },
      explanation: '注意：參數名稱是 path，不是 directoryPath 或 input',
      expectedOutput: '限制深度的 src 目錄樹狀結構'
    }
  ],
  
  commonErrors: [
    {
      error: '參數名稱錯誤：使用了 "directoryPath" 或 "input" 而不是 "path"',
      cause: 'AI調用時傳錯了參數名稱',
      solution: '必須使用 { "path": "src" } 格式'
    },
    {
      error: 'tree 命令未找到',
      cause: 'Docker 容器內沒有安裝 tree 命令',
      solution: '系統會自動安裝 tree 命令，或使用 docker_ls 替代'
    }
  ],
  
  successPatterns: [
    '成功顯示樹狀結構',
    '目錄結構',
    'directories, files'
  ],
  
  category: ToolCategory.DOCKER_OPERATIONS
};

/**
 * 檔案創建/修改工具 - 增強版
 */
export const CREATE_FILE_SCHEMA: EnhancedToolSchema = {
  name: 'create_file',
  description: `創建新檔案或完全覆蓋現有檔案內容。

🎯 **使用時機**：
- 用戶要求創建新檔案
- 用戶要求修改檔案內容（完全替換）
- 用戶說"改成"、"修改為"、"創建"

📝 **內容格式**：
- 提供完整的檔案內容
- 確保語法正確性
- 保持原有的縮排和格式

⚠️ **重要提醒**：
- 此工具會完全覆蓋檔案內容
- 修改前應先使用 read_file 了解現有內容
- 對於複雜修改，考慮使用 diff 工具`,
  
  parameters: z.object({
    filePath: z.string()
      .describe('檔案路徑（相對路徑）'),
    content: z.string()
      .describe('完整的檔案內容')
      .min(1, '檔案內容不能為空')
  }),
  
  examples: [
    {
      scenario: '修改主頁標題',
      input: {
        filePath: 'src/app/page.tsx',
        content: 'import Image from "next/image";\n\nexport default function Home() {\n  return (\n    <div className="...">\n      <h1>AI網頁編輯測試</h1>\n      ...\n    </div>\n  );\n}'
      },
      explanation: '完整替換主頁內容，添加新標題',
      expectedOutput: '成功創建/修改檔案'
    }
  ],
  
  commonErrors: [
    {
      error: '語法錯誤',
      cause: '檔案內容包含語法錯誤',
      solution: '檢查括號、引號、分號等語法元素'
    },
    {
      error: '路徑權限問題',
      cause: '嘗試寫入受保護的路徑',
      solution: '確保路徑在專案工作目錄內'
    }
  ],
  
  successPatterns: [
    '檔案創建成功',
    '檔案修改完成',
    '內容已保存'
  ],
  
  category: ToolCategory.FILE_OPERATIONS
};

/**
 * 目錄列表工具 - 增強版
 */
export const LIST_DIRECTORY_SCHEMA: EnhancedToolSchema = {
  name: 'list_directory',
  description: `列出指定目錄的內容，用於探索專案結構。

🎯 **使用時機**：
- 用戶詢問"有哪些檔案"、"專案結構"
- 需要了解目錄內容
- 尋找特定檔案的位置

📁 **常用目錄**：
- 根目錄：''（空字串）
- 源碼目錄：'src'
- 應用目錄：'src/app'
- 組件目錄：'src/components'`,
  
  parameters: z.object({
    directoryPath: z.string()
      .describe('目錄路徑（相對路徑，空字串表示根目錄）')
      .default('')
  }),
  
  examples: [
    {
      scenario: '查看專案根目錄',
      input: { directoryPath: '' },
      explanation: '空字串表示專案根目錄',
      expectedOutput: '專案根目錄的檔案列表'
    },
    {
      scenario: '查看 src 目錄',
      input: { directoryPath: 'src' },
      explanation: '查看源碼目錄結構',
      expectedOutput: 'src 目錄下的檔案和資料夾'
    }
  ],
  
  commonErrors: [
    {
      error: '目錄不存在',
      cause: '指定的目錄路徑不存在',
      solution: '檢查路徑拼寫，先從根目錄開始'
    }
  ],
  
  successPatterns: [
    '成功列出目錄',
    '找到檔案',
    '目錄內容'
  ],
  
  category: ToolCategory.FILE_OPERATIONS
};

// === 工具 Schema 註冊表 ===
export const ENHANCED_TOOL_SCHEMAS: Record<string, EnhancedToolSchema> = {
  docker_read_file: DOCKER_READ_FILE_SCHEMA,
  docker_ls: DOCKER_LS_SCHEMA,
  docker_tree: DOCKER_TREE_SCHEMA,
  read_file: READ_FILE_SCHEMA,
  create_file: CREATE_FILE_SCHEMA,
  list_directory: LIST_DIRECTORY_SCHEMA
};

// === 工具描述生成器 ===
export function getEnhancedToolSchema(toolName: string): EnhancedToolSchema | null {
  return ENHANCED_TOOL_SCHEMAS[toolName] || null;
}

export function generateToolDescription(toolName: string): string {
  const schema = getEnhancedToolSchema(toolName);
  if (!schema) {
    return `工具 ${toolName} 的描述不可用`;
  }

  return `
## ${schema.name}

${schema.description}

### 使用範例：
${schema.examples.map(example => `
**${example.scenario}**
輸入: \`${JSON.stringify(example.input)}\`
說明: ${example.explanation}
`).join('\n')}

### 常見錯誤：
${schema.commonErrors.map(error => `
- **${error.error}**: ${error.cause}
  解決方案: ${error.solution}
`).join('\n')}
  `;
}

export function generateAllToolsDescription(): string {
  return `
# 🛠️ 工具使用指南

${Object.values(ENHANCED_TOOL_SCHEMAS).map(schema => generateToolDescription(schema.name)).join('\n\n---\n\n')}

## 🎯 重要提醒

1. **參數名稱必須正確**：
   - docker_read_file: 使用 "filePath"，不是 "input"
   - docker_ls: 使用 "path"，不是 "directoryPath" 或 "input"
   - docker_tree: 使用 "path"，不是 "directoryPath" 或 "input"

2. **路徑格式規範**：
   - 使用相對路徑：src/app/page.tsx
   - 避免絕對路徑：/app/workspace/...
   - 避免 ./ 開頭：./src/app/page.tsx

3. **工具選擇建議**：
   - 查看檔案內容：使用 docker_read_file
   - 列出目錄內容：使用 docker_ls（推薦）或 list_directory
   - 查看專案結構：使用 docker_tree

4. **錯誤處理**：
   - 如果工具執行失敗，檢查參數名稱是否正確
   - 確認路徑格式符合規範
   - 必要時使用其他工具確認檔案或目錄存在
  `;
}

// === 智能工具建議器 ===
export function suggestToolForRequest(userMessage: string): { toolName: string; reasoning: string } | null {
  const message = userMessage.toLowerCase();

  if (message.includes('讀取') || message.includes('查看') || message.includes('看看') || message.includes('read')) {
    return {
      toolName: 'docker_read_file',
      reasoning: '用戶想要讀取檔案內容，建議使用 docker_read_file，參數名稱是 filePath'
    };
  }

  if (message.includes('列出') || message.includes('有哪些') || message.includes('檔案') || message.includes('list')) {
    return {
      toolName: 'docker_ls',
      reasoning: '用戶想要列出目錄內容，建議使用 docker_ls，參數名稱是 path'
    };
  }

  if (message.includes('結構') || message.includes('樹狀') || message.includes('tree') || message.includes('專案結構')) {
    return {
      toolName: 'docker_tree',
      reasoning: '用戶想要查看專案結構，建議使用 docker_tree，參數名稱是 path'
    };
  }

  return null;
} 