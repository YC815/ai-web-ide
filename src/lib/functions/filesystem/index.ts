/**
 * 檔案系統相關 OpenAI Function Call 定義
 */

import { 
  FunctionDefinition, 
  ToolCategory, 
  FunctionAccessLevel 
} from '../types';
import type { OpenAIFunctionSchema } from '../categories';

// 檔案系統搜尋
export const filesystemSearch: FunctionDefinition = {
  id: 'filesystem_search',
  schema: {
    name: 'filesystem_search',
    description: '在檔案系統中搜尋檔案或目錄',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜尋查詢字串'
        },
        fileType: {
          type: 'string',
          description: '檔案類型過濾（如: js, ts, md）'
        },
        maxResults: {
          type: 'number',
          description: '最大結果數量',
          default: 50
        }
      },
      required: ['query']
    }
  },
  metadata: {
    category: ToolCategory.FILESYSTEM,
    accessLevel: FunctionAccessLevel.PUBLIC,
    version: '1.0.0',
    author: 'AI Creator Team',
    tags: ['filesystem', 'search'],
    rateLimited: true,
    maxCallsPerMinute: 30
  },
  handler: async (parameters: { query: string; fileType?: string; maxResults?: number }) => {
    // 實現檔案搜尋邏輯
    return {
      success: true,
      data: {
        query: parameters.query,
        results: [],
        totalFound: 0
      }
    };
  }
};

// 檔案內容搜尋
export const filesystemContentSearch: FunctionDefinition = {
  id: 'filesystem_content_search',
  schema: {
    name: 'filesystem_content_search',
    description: '在檔案內容中搜尋特定文字',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: '搜尋模式（支援正規表達式）'
        },
        directory: {
          type: 'string',
          description: '搜尋目錄',
          default: '.'
        },
        fileExtensions: {
          type: 'string',
          description: '檔案副檔名過濾（逗號分隔）'
        },
        caseSensitive: {
          type: 'boolean',
          description: '是否區分大小寫',
          default: false
        }
      },
      required: ['pattern']
    }
  },
  metadata: {
    category: ToolCategory.FILESYSTEM,
    accessLevel: FunctionAccessLevel.RESTRICTED,
    version: '1.0.0',
    author: 'AI Creator Team',
    tags: ['filesystem', 'search', 'content'],
    requiresAuth: true,
    rateLimited: true,
    maxCallsPerMinute: 20
  },
  handler: async (parameters: { 
    pattern: string; 
    directory?: string; 
    fileExtensions?: string;
    caseSensitive?: boolean;
  }) => {
    // 實現內容搜尋邏輯
    return {
      success: true,
      data: {
        pattern: parameters.pattern,
        matches: [],
        totalMatches: 0
      }
    };
  }
};

// 檔案統計資訊
export const filesystemStats: FunctionDefinition = {
  id: 'filesystem_stats',
  schema: {
    name: 'filesystem_stats',
    description: '獲取檔案系統統計資訊',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '要統計的路徑',
          default: '.'
        },
        includeHidden: {
          type: 'boolean',
          description: '是否包含隱藏檔案',
          default: false
        }
      }
    }
  },
  metadata: {
    category: ToolCategory.FILESYSTEM,
    accessLevel: FunctionAccessLevel.PUBLIC,
    version: '1.0.0',
    author: 'AI Creator Team',
    tags: ['filesystem', 'stats'],
    rateLimited: true,
    maxCallsPerMinute: 30
  },
  handler: async (parameters: { path?: string; includeHidden?: boolean }) => {
    // 實現檔案統計邏輯
    return {
      success: true,
      data: {
        path: parameters.path || '.',
        totalFiles: 0,
        totalDirectories: 0,
        totalSize: 0,
        fileTypes: {}
      }
    };
  }
};

// 導出所有檔案系統工具
export const filesystemFunctions: FunctionDefinition[] = [
  filesystemSearch,
  filesystemContentSearch,
  filesystemStats
];

// 獲取檔案系統工具的 OpenAI Function Schema
export function getFilesystemFunctionSchemas(): OpenAIFunctionSchema[] {
  return filesystemFunctions.map(func => func.schema);
}

// 獲取檔案系統工具名稱列表
export function getFilesystemFunctionNames(): string[] {
  return filesystemFunctions.map(func => func.id);
} 