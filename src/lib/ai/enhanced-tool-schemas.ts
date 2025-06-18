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
 * 檔案讀取工具 - 增強版
 */
export const READ_FILE_SCHEMA: EnhancedToolSchema = {
  name: 'read_file',
  description: `讀取指定檔案的內容。

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
- "樣式檔案" → globals.css, tailwind.config.js`,
  
  parameters: z.object({
    filePath: z.string()
      .describe('檔案路徑（相對路徑，如：src/app/page.tsx）')
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
    }
  ],
  
  commonErrors: [
    {
      error: '使用絕對路徑',
      cause: '路徑以 / 開頭，如 /app/workspace/...',
      solution: '改用相對路徑，如 src/app/page.tsx'
    },
    {
      error: '檔案不存在',
      cause: '路徑錯誤或檔案確實不存在',
      solution: '檢查路徑拼寫，或使用 list_directory 確認檔案位置'
    }
  ],
  
  successPatterns: [
    '成功讀取檔案',
    '檔案內容如下',
    '找到檔案'
  ],
  
  category: ToolCategory.FILE_OPERATIONS
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
      expectedOutput: '顯示根目錄的檔案和資料夾列表'
    },
    {
      scenario: '查看源碼目錄',
      input: { directoryPath: 'src' },
      explanation: '查看 src 目錄的內容',
      expectedOutput: '顯示 src 目錄下的檔案和子目錄'
    }
  ],
  
  commonErrors: [
    {
      error: '目錄不存在',
      cause: '指定的目錄路徑不存在',
      solution: '檢查路徑拼寫或使用父目錄路徑'
    }
  ],
  
  successPatterns: [
    '目錄內容如下',
    '找到以下檔案',
    '目錄列表'
  ],
  
  category: ToolCategory.FILE_OPERATIONS
};

/**
 * 專案探索工具 - 增強版
 */
export const COMPREHENSIVE_PROJECT_EXPLORATION_SCHEMA: EnhancedToolSchema = {
  name: 'comprehensive_project_exploration',
  description: `執行完整的專案分析和結構探索。

🎯 **使用時機**：
- 用戶詢問專案狀態、結構、內容
- 第一次對話需要了解專案
- 用戶說"查看專案"、"分析專案"、"專案有什麼"

🔍 **分析內容**：
- 專案架構類型（Next.js App Router/Pages Router）
- 依賴分析和版本資訊
- 檔案結構和組織方式
- 配置檔案狀態
- 開發環境設置

⚡ **自動執行**：
- 無需參數，自動分析整個專案
- 生成詳細的專案報告
- 提供開發建議`,
  
  parameters: z.object({}), // 無參數
  
  examples: [
    {
      scenario: '用戶詢問專案狀態',
      input: {},
      explanation: '無需參數，自動分析整個專案',
      expectedOutput: '完整的專案分析報告，包含架構、依賴、檔案結構等'
    }
  ],
  
  commonErrors: [
    {
      error: '專案未初始化',
      cause: '目錄中沒有找到專案檔案',
      solution: '檢查是否在正確的專案目錄中'
    }
  ],
  
  successPatterns: [
    '專案探索完成',
    '分析結果如下',
    '專案架構報告'
  ],
  
  category: ToolCategory.PROJECT_MANAGEMENT
};

/**
 * Diff 工具 - 增強版
 */
export const LOCAL_APPLY_DIFF_SCHEMA: EnhancedToolSchema = {
  name: 'local_apply_diff',
  description: `使用 unified diff 格式精確修改檔案內容。

🎯 **使用時機**：
- 需要精確修改檔案的特定部分
- 複雜的程式碼變更
- 保留原有內容，只修改特定行

📝 **Diff 格式要求**：
- 使用標準 unified diff 格式
- 包含上下文行（@@ -old,count +new,count @@）
- 明確標示新增（+）和刪除（-）的行

✨ **優勢**：
- 比完全覆蓋更安全
- 可以精確控制修改範圍
- 支援複雜的程式碼重構`,
  
  parameters: z.object({
    filePath: z.string()
      .describe('要修改的檔案路徑（相對路徑）'),
    diffContent: z.string()
      .describe('unified diff 格式的修改內容')
      .refine(content => content.includes('@@'), 'diff 內容必須包含 @@ 標記')
  }),
  
  examples: [
    {
      scenario: '在主頁添加標題',
      input: {
        filePath: 'src/app/page.tsx',
        diffContent: `@@ -8,6 +8,7 @@
     <div className="grid grid-rows-[20px_1fr_20px]...">
       <main className="flex flex-col gap-[32px]...">
+        <h1 className="text-2xl font-bold">AI網頁編輯測試</h1>
         <Image
           className="dark:invert"`
      },
      explanation: '使用 diff 格式在指定位置添加 h1 標題',
      expectedOutput: 'Diff 應用成功，檔案已修改'
    }
  ],
  
  commonErrors: [
    {
      error: 'Diff 格式錯誤',
      cause: '缺少 @@ 標記或格式不正確',
      solution: '確保使用標準 unified diff 格式'
    },
    {
      error: '上下文不匹配',
      cause: 'Diff 中的上下文與檔案實際內容不符',
      solution: '先讀取檔案確認當前內容，然後生成正確的 diff'
    }
  ],
  
  successPatterns: [
    'Diff 應用成功',
    '檔案修改完成',
    '變更已生效'
  ],
  
  category: ToolCategory.FILE_OPERATIONS
};

// === 工具 Schema 註冊表 ===
export const ENHANCED_TOOL_SCHEMAS = {
  read_file: READ_FILE_SCHEMA,
  create_file: CREATE_FILE_SCHEMA,
  list_directory: LIST_DIRECTORY_SCHEMA,
  comprehensive_project_exploration: COMPREHENSIVE_PROJECT_EXPLORATION_SCHEMA,
  local_apply_diff: LOCAL_APPLY_DIFF_SCHEMA
} as const;

/**
 * 根據工具名稱獲取增強的 Schema
 */
export function getEnhancedToolSchema(toolName: string): EnhancedToolSchema | null {
  return ENHANCED_TOOL_SCHEMAS[toolName as keyof typeof ENHANCED_TOOL_SCHEMAS] || null;
}

/**
 * 生成工具的詳細說明文字（用於 prompt）
 */
export function generateToolDescription(toolName: string): string {
  const schema = getEnhancedToolSchema(toolName);
  if (!schema) return '';

  let description = `**${schema.name}**: ${schema.description}\n\n`;
  
  // 添加示例
  if (schema.examples.length > 0) {
    description += '📚 **使用範例**:\n';
    schema.examples.forEach(example => {
      description += `- ${example.scenario}: ${JSON.stringify(example.input)}\n`;
    });
    description += '\n';
  }
  
  // 添加常見錯誤
  if (schema.commonErrors.length > 0) {
    description += '⚠️ **避免錯誤**:\n';
    schema.commonErrors.forEach(error => {
      description += `- ${error.error}: ${error.solution}\n`;
    });
    description += '\n';
  }
  
  return description;
}

/**
 * 生成所有工具的綜合說明（用於系統 prompt）
 */
export function generateAllToolsDescription(): string {
  let description = '# 🛠️ 可用工具詳細說明\n\n';
  
  Object.values(ENHANCED_TOOL_SCHEMAS).forEach(schema => {
    description += generateToolDescription(schema.name);
    description += '---\n\n';
  });
  
  return description;
} 