/**
 * Docker 相關 OpenAI Function Call 定義
 */

import { 
  FunctionDefinition, 
  ToolCategory, 
  FunctionAccessLevel 
} from '../types';
import type { OpenAIFunctionSchema } from '../categories';
// Docker 工具的統一 Function Call 實現
// 簡化的 Docker 工具實現（用於統一 Function Call 系統）
interface SimpleDockerTools {
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<string>;
  listDirectory(dirPath: string): Promise<string[]>;
  findFiles(pattern: string, searchPath: string): Promise<string[]>;
  checkPathExists(path: string): Promise<boolean>;
  getProjectInfo(): Promise<any>;
}

// 簡化的 Docker 工具實例
const dockerTools: SimpleDockerTools = {
  async readFile(filePath: string): Promise<string> {
    // 簡化實現 - 在實際使用中應該調用真正的 Docker API
    return `Mock content for file: ${filePath}`;
  },

  async writeFile(filePath: string, content: string): Promise<string> {
    // 簡化實現
    return `Successfully wrote ${content.length} characters to ${filePath}`;
  },

  async listDirectory(dirPath: string): Promise<string[]> {
    // 簡化實現
    return [`${dirPath}/file1.ts`, `${dirPath}/file2.js`, `${dirPath}/subdir/`];
  },

  async findFiles(pattern: string, searchPath: string): Promise<string[]> {
    // 簡化實現
    return [`${searchPath}/match1.ts`, `${searchPath}/match2.js`];
  },

  async checkPathExists(path: string): Promise<boolean> {
    // 簡化實現
    return true;
  },

  async getProjectInfo(): Promise<any> {
    // 簡化實現
    return {
      name: 'AI Creator Project',
      type: 'Next.js',
      version: '1.0.0',
      dependencies: ['react', 'next', 'typescript']
    };
  }
};

async function getDockerTools(): Promise<SimpleDockerTools> {
  return dockerTools;
}

// Docker 讀取檔案
export const dockerReadFile: FunctionDefinition = {
  id: 'docker_read_file',
  schema: {
    name: 'docker_read_file',
    description: '讀取 Docker 容器內的檔案內容',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '要讀取的檔案路徑（相對於專案根目錄）'
        }
      },
      required: ['filePath']
    }
  },
  metadata: {
    category: ToolCategory.DOCKER,
    accessLevel: FunctionAccessLevel.RESTRICTED,
    version: '2.0.0',
    author: 'AI Creator Team',
    tags: ['docker', 'file', 'read'],
    requiresAuth: true,
    rateLimited: true,
    maxCallsPerMinute: 60
  },
  handler: async (parameters: { filePath: string }, context?: any) => {
    const dockerTools = await getDockerTools();
    return await dockerTools.readFile(parameters.filePath);
  },
  validator: async (parameters: { filePath: string }) => {
    if (!parameters.filePath || typeof parameters.filePath !== 'string') {
      return { isValid: false, reason: 'filePath 必須是非空字串' };
    }
    if (parameters.filePath.includes('..')) {
      return { isValid: false, reason: '檔案路徑不能包含 ..' };
    }
    return { isValid: true };
  }
};

// Docker 列出目錄
export const dockerListDirectory: FunctionDefinition = {
  id: 'docker_list_directory',
  schema: {
    name: 'docker_list_directory',
    description: '列出 Docker 容器內目錄的內容',
    parameters: {
      type: 'object',
      properties: {
        dirPath: {
          type: 'string',
          description: '要列出的目錄路徑（相對於專案根目錄）',
          default: '.'
        }
      }
    }
  },
  metadata: {
    category: ToolCategory.DOCKER,
    accessLevel: FunctionAccessLevel.RESTRICTED,
    version: '2.0.0',
    author: 'AI Creator Team',
    tags: ['docker', 'directory', 'list'],
    requiresAuth: true,
    rateLimited: true,
    maxCallsPerMinute: 60
  },
  handler: async (parameters: { dirPath?: string }, context?: any) => {
    const dockerTools = await getDockerTools();
    return await dockerTools.listDirectory(parameters.dirPath || '.');
  }
};

// Docker 寫入檔案
export const dockerWriteFile: FunctionDefinition = {
  id: 'docker_write_file',
  schema: {
    name: 'docker_write_file',
    description: '寫入內容到 Docker 容器內的檔案',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '要寫入的檔案路徑（相對於專案根目錄）'
        },
        content: {
          type: 'string',
          description: '要寫入的檔案內容'
        }
      },
      required: ['filePath', 'content']
    }
  },
  metadata: {
    category: ToolCategory.DOCKER,
    accessLevel: FunctionAccessLevel.RESTRICTED,
    version: '2.0.0',
    author: 'AI Creator Team',
    tags: ['docker', 'file', 'write'],
    requiresAuth: true,
    rateLimited: true,
    maxCallsPerMinute: 30
  },
  handler: async (parameters: { filePath: string; content: string }, context?: any) => {
    const dockerTools = await getDockerTools();
    return await dockerTools.writeFile(parameters.filePath, parameters.content);
  },
  validator: async (parameters: { filePath: string; content: string }) => {
    if (!parameters.filePath || typeof parameters.filePath !== 'string') {
      return { isValid: false, reason: 'filePath 必須是非空字串' };
    }
    if (typeof parameters.content !== 'string') {
      return { isValid: false, reason: 'content 必須是字串' };
    }
    if (parameters.filePath.includes('..')) {
      return { isValid: false, reason: '檔案路徑不能包含 ..' };
    }
    return { isValid: true };
  }
};

// Docker 尋找檔案
export const dockerFindFiles: FunctionDefinition = {
  id: 'docker_find_files',
  schema: {
    name: 'docker_find_files',
    description: '在 Docker 容器內搜尋符合條件的檔案',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: '搜尋模式（支援萬用字元）'
        },
        searchPath: {
          type: 'string',
          description: '搜尋路徑（相對於專案根目錄）',
          default: '.'
        }
      },
      required: ['pattern']
    }
  },
  metadata: {
    category: ToolCategory.DOCKER,
    accessLevel: FunctionAccessLevel.RESTRICTED,
    version: '2.0.0',
    author: 'AI Creator Team',
    tags: ['docker', 'search', 'find'],
    requiresAuth: true,
    rateLimited: true,
    maxCallsPerMinute: 30
  },
  handler: async (parameters: { pattern: string; searchPath?: string }, context?: any) => {
    const dockerTools = await getDockerTools();
    return await dockerTools.findFiles(parameters.pattern, parameters.searchPath || '.');
  }
};

// Docker 檢查路徑存在
export const dockerCheckPathExists: FunctionDefinition = {
  id: 'docker_check_path_exists',
  schema: {
    name: 'docker_check_path_exists',
    description: '檢查 Docker 容器內的路徑是否存在',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '要檢查的路徑（相對於專案根目錄）'
        }
      },
      required: ['path']
    }
  },
  metadata: {
    category: ToolCategory.DOCKER,
    accessLevel: FunctionAccessLevel.RESTRICTED,
    version: '2.0.0',
    author: 'AI Creator Team',
    tags: ['docker', 'path', 'exists'],
    requiresAuth: true,
    rateLimited: true,
    maxCallsPerMinute: 60
  },
  handler: async (parameters: { path: string }, context?: any) => {
    const dockerTools = await getDockerTools();
    return await dockerTools.checkPathExists(parameters.path);
  }
};

// Docker 獲取專案資訊
export const dockerGetProjectInfo: FunctionDefinition = {
  id: 'docker_get_project_info',
  schema: {
    name: 'docker_get_project_info',
    description: '獲取 Docker 容器內的專案資訊',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  metadata: {
    category: ToolCategory.DOCKER,
    accessLevel: FunctionAccessLevel.PUBLIC,
    version: '2.0.0',
    author: 'AI Creator Team',
    tags: ['docker', 'project', 'info'],
    rateLimited: true,
    maxCallsPerMinute: 30
  },
  handler: async (parameters: {}, context?: any) => {
    const dockerTools = await getDockerTools();
    return await dockerTools.getProjectInfo();
  }
};

// 導出所有 Docker 工具
export const dockerFunctions: FunctionDefinition[] = [
  dockerReadFile,
  dockerListDirectory,
  dockerWriteFile,
  dockerFindFiles,
  dockerCheckPathExists,
  dockerGetProjectInfo
];

// 獲取 Docker 工具的 OpenAI Function Schema
export function getDockerFunctionSchemas(): OpenAIFunctionSchema[] {
  return dockerFunctions.map(func => func.schema);
}

// 獲取 Docker 工具名稱列表
export function getDockerFunctionNames(): string[] {
  return dockerFunctions.map(func => func.id);
} 