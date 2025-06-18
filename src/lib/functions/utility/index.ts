/**
 * 實用工具相關 OpenAI Function Call 定義
 */

import { 
  FunctionDefinition, 
  ToolCategory, 
  FunctionAccessLevel 
} from '../types';
import type { OpenAIFunctionSchema } from '../categories';
import { diffTools } from './diff-tool';

// 時間戳轉換
export const utilityFormatTimestamp: FunctionDefinition = {
  id: 'utility_format_timestamp',
  schema: {
    name: 'utility_format_timestamp',
    description: '格式化時間戳為可讀格式',
    parameters: {
      type: 'object',
      properties: {
        timestamp: {
          type: 'number',
          description: 'Unix 時間戳（毫秒）'
        },
        format: {
          type: 'string',
          description: '時間格式（如: YYYY-MM-DD HH:mm:ss）',
          default: 'YYYY-MM-DD HH:mm:ss'
        },
        timezone: {
          type: 'string',
          description: '時區（如: Asia/Taipei）',
          default: 'Asia/Taipei'
        }
      },
      required: ['timestamp']
    }
  },
  metadata: {
    category: ToolCategory.UTILITY,
    accessLevel: FunctionAccessLevel.PUBLIC,
    version: '1.0.0',
    author: 'AI Creator Team',
    tags: ['utility', 'time', 'format'],
    rateLimited: false
  },
  handler: async (parameters: { timestamp: number; format?: string; timezone?: string }) => {
    const date = new Date(parameters.timestamp);
    const format = parameters.format || 'YYYY-MM-DD HH:mm:ss';
    
    // 簡單的日期格式化（實際應用中可使用 date-fns 或 moment.js）
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    const formatted = format
      .replace('YYYY', year.toString())
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
    
    return {
      success: true,
      data: {
        original: parameters.timestamp,
        formatted: formatted,
        timezone: parameters.timezone || 'Asia/Taipei'
      }
    };
  }
};

// JSON 格式化
export const utilityFormatJson: FunctionDefinition = {
  id: 'utility_format_json',
  schema: {
    name: 'utility_format_json',
    description: '格式化 JSON 字串',
    parameters: {
      type: 'object',
      properties: {
        jsonString: {
          type: 'string',
          description: '要格式化的 JSON 字串'
        },
        indent: {
          type: 'number',
          description: '縮排空格數',
          default: 2
        }
      },
      required: ['jsonString']
    }
  },
  metadata: {
    category: ToolCategory.UTILITY,
    accessLevel: FunctionAccessLevel.PUBLIC,
    version: '1.0.0',
    author: 'AI Creator Team',
    tags: ['utility', 'json', 'format'],
    rateLimited: false
  },
  handler: async (parameters: { jsonString: string; indent?: number }) => {
    try {
      const parsed = JSON.parse(parameters.jsonString);
      const formatted = JSON.stringify(parsed, null, parameters.indent || 2);
      
      return {
        success: true,
        data: {
          original: parameters.jsonString,
          formatted: formatted,
          isValid: true
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `JSON 格式錯誤: ${error}`,
        data: {
          original: parameters.jsonString,
          isValid: false
        }
      };
    }
  }
};

// Base64 編碼/解碼
export const utilityBase64: FunctionDefinition = {
  id: 'utility_base64',
  schema: {
    name: 'utility_base64',
    description: 'Base64 編碼或解碼',
    parameters: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: '要處理的字串'
        },
        operation: {
          type: 'string',
          description: '操作類型',
          enum: ['encode', 'decode']
        }
      },
      required: ['input', 'operation']
    }
  },
  metadata: {
    category: ToolCategory.UTILITY,
    accessLevel: FunctionAccessLevel.PUBLIC,
    version: '1.0.0',
    author: 'AI Creator Team',
    tags: ['utility', 'base64', 'encode', 'decode'],
    rateLimited: false
  },
  handler: async (parameters: { input: string; operation: 'encode' | 'decode' }) => {
    try {
      let result: string;
      
      if (parameters.operation === 'encode') {
        result = Buffer.from(parameters.input, 'utf8').toString('base64');
      } else {
        result = Buffer.from(parameters.input, 'base64').toString('utf8');
      }
      
      return {
        success: true,
        data: {
          input: parameters.input,
          operation: parameters.operation,
          result: result
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Base64 ${parameters.operation} 失敗: ${error}`,
        data: {
          input: parameters.input,
          operation: parameters.operation
        }
      };
    }
  }
};

// URL 編碼/解碼
export const utilityUrlEncode: FunctionDefinition = {
  id: 'utility_url_encode',
  schema: {
    name: 'utility_url_encode',
    description: 'URL 編碼或解碼',
    parameters: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: '要處理的字串'
        },
        operation: {
          type: 'string',
          description: '操作類型',
          enum: ['encode', 'decode']
        }
      },
      required: ['input', 'operation']
    }
  },
  metadata: {
    category: ToolCategory.UTILITY,
    accessLevel: FunctionAccessLevel.PUBLIC,
    version: '1.0.0',
    author: 'AI Creator Team',
    tags: ['utility', 'url', 'encode', 'decode'],
    rateLimited: false
  },
  handler: async (parameters: { input: string; operation: 'encode' | 'decode' }) => {
    try {
      let result: string;
      
      if (parameters.operation === 'encode') {
        result = encodeURIComponent(parameters.input);
      } else {
        result = decodeURIComponent(parameters.input);
      }
      
      return {
        success: true,
        data: {
          input: parameters.input,
          operation: parameters.operation,
          result: result
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `URL ${parameters.operation} 失敗: ${error}`,
        data: {
          input: parameters.input,
          operation: parameters.operation
        }
      };
    }
  }
};

// 雜湊計算
export const utilityHash: FunctionDefinition = {
  id: 'utility_hash',
  schema: {
    name: 'utility_hash',
    description: '計算字串的雜湊值',
    parameters: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: '要計算雜湊的字串'
        },
        algorithm: {
          type: 'string',
          description: '雜湊演算法',
          enum: ['md5', 'sha1', 'sha256', 'sha512'],
          default: 'sha256'
        }
      },
      required: ['input']
    }
  },
  metadata: {
    category: ToolCategory.UTILITY,
    accessLevel: FunctionAccessLevel.PUBLIC,
    version: '1.0.0',
    author: 'AI Creator Team',
    tags: ['utility', 'hash', 'crypto'],
    rateLimited: true,
    maxCallsPerMinute: 60
  },
  handler: async (parameters: { input: string; algorithm?: string }) => {
    try {
      const crypto = require('crypto');
      const algorithm = parameters.algorithm || 'sha256';
      const hash = crypto.createHash(algorithm).update(parameters.input).digest('hex');
      
      return {
        success: true,
        data: {
          input: parameters.input,
          algorithm: algorithm,
          hash: hash
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `雜湊計算失敗: ${error}`,
        data: {
          input: parameters.input,
          algorithm: parameters.algorithm || 'sha256'
        }
      };
    }
  }
};

// 導出所有實用工具
export const utilityFunctions: FunctionDefinition[] = [
  utilityFormatTimestamp,
  utilityFormatJson,
  utilityBase64,
  utilityUrlEncode,
  utilityHash,
  ...diffTools
];

// 獲取實用工具的 OpenAI Function Schema
export function getUtilityFunctionSchemas(): OpenAIFunctionSchema[] {
  return utilityFunctions.map(func => func.schema);
}

// 獲取實用工具名稱列表
export function getUtilityFunctionNames(): string[] {
  return utilityFunctions.map(func => func.id);
} 