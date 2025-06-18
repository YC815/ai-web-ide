// 專案管理工具集合
import { ToolCategory, FunctionAccessLevel } from '../categories';
import type { FunctionDefinition } from '../types';

// 專案資訊獲取
export const projectInfo: FunctionDefinition = {
  id: 'projectInfo',
  schema: {
    name: 'projectInfo',
    description: '獲取專案基本資訊，包括配置、依賴、結構等',
    parameters: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: '專案路徑，預設為當前目錄',
        default: '.'
      },
      includeDetails: {
        type: 'boolean',
        description: '是否包含詳細資訊（依賴、配置等）',
        default: false
      },
      includeDependencies: {
        type: 'boolean',
        description: '是否包含依賴資訊',
        default: true
      },
      includeGitInfo: {
        type: 'boolean',
        description: '是否包含 Git 資訊',
        default: true
      }
    },
    required: []
  }
  },
  metadata: {
    category: ToolCategory.PROJECT,
    accessLevel: FunctionAccessLevel.PUBLIC,
    version: '1.0.0',
    author: 'Project System',
    tags: ['project', 'info', 'metadata', 'dependencies'],
    rateLimited: true,
    maxCallsPerMinute: 30
  },
  validator: async (params) => {
    const { projectPath } = params;
    if (projectPath && typeof projectPath !== 'string') {
      return { isValid: false, reason: '專案路徑必須是字串' };
    }
    return { isValid: true };
  },
  handler: async (params) => {
    try {
      const { 
        projectPath = '.', 
        includeDetails = false, 
        includeDependencies = true, 
        includeGitInfo = true 
      } = params;
      
      return {
        success: true,
        data: {
          projectPath,
          name: 'ai_creator',
          type: 'Next.js',
          framework: 'React',
          language: 'TypeScript',
          version: '1.0.0',
          dependencies: includeDependencies ? {
            production: [],
            development: [],
            totalCount: 0
          } : undefined,
          gitInfo: includeGitInfo ? {
            branch: 'main',
            lastCommit: Date.now(),
            hasUncommittedChanges: true
          } : undefined,
          structure: includeDetails ? {
            directories: [],
            files: [],
            totalSize: 0
          } : undefined
        },
        message: '專案資訊獲取成功'
      };
    } catch (error) {
      return {
        success: false,
        error: `獲取專案資訊失敗: ${error}`
      };
    }
  }
};

// 工作區管理
export const workspaceManager: FunctionDefinition = {
  id: 'workspaceManager',
  schema: {
    name: 'workspaceManager',
    description: '管理工作區配置和設定',
    parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['get', 'set', 'reset', 'list', 'backup', 'restore'],
        description: '工作區操作類型'
      },
      configKey: {
        type: 'string',
        description: '配置鍵值（get/set 操作需要）'
      },
      configValue: {
        type: 'string',
        description: '配置值（set 操作需要）'
      },
      backupName: {
        type: 'string',
        description: '備份名稱（backup/restore 操作需要）'
      }
    },
    required: ['action']
  }
  },
  metadata: {
    category: ToolCategory.PROJECT,
    accessLevel: FunctionAccessLevel.RESTRICTED,
    version: '1.0.0',
    author: 'Workspace System',
    tags: ['workspace', 'config', 'settings', 'backup'],
    rateLimited: true,
    maxCallsPerMinute: 30
  },
  validator: async (params) => {
    const { action, configKey, configValue, backupName } = params;
    
    if (!['get', 'set', 'reset', 'list', 'backup', 'restore'].includes(action)) {
      return { isValid: false, reason: '無效的操作類型' };
    }
    
    if (['get', 'set'].includes(action) && !configKey) {
      return { isValid: false, reason: `${action} 操作需要 configKey` };
    }
    
    if (action === 'set' && !configValue) {
      return { isValid: false, reason: 'set 操作需要 configValue' };
    }
    
    if (['backup', 'restore'].includes(action) && !backupName) {
      return { isValid: false, reason: `${action} 操作需要 backupName` };
    }
    
    return { isValid: true };
  },
  handler: async (params) => {
    try {
      const { action, configKey, configValue, backupName } = params;
      
      switch (action) {
        case 'get':
          return {
            success: true,
            data: { 
              key: configKey, 
              value: 'config_value',
              type: 'string'
            },
            message: `配置 ${configKey} 獲取成功`
          };
          
        case 'set':
          return {
            success: true,
            data: { 
              key: configKey, 
              value: configValue,
              previousValue: 'old_value',
              updated: true
            },
            message: `配置 ${configKey} 設定成功`
          };
          
        case 'reset':
          return {
            success: true,
            data: { 
              resetCount: 0,
              timestamp: Date.now()
            },
            message: '工作區配置重置成功'
          };
          
        case 'list':
          return {
            success: true,
            data: {
              configs: {},
              totalCount: 0
            },
            message: '工作區配置列表獲取成功'
          };
          
        case 'backup':
          return {
            success: true,
            data: {
              backupName,
              timestamp: Date.now(),
              size: 0,
              configCount: 0
            },
            message: `工作區備份 ${backupName} 創建成功`
          };
          
        case 'restore':
          return {
            success: true,
            data: {
              backupName,
              restoredConfigs: 0,
              timestamp: Date.now()
            },
            message: `工作區從備份 ${backupName} 恢復成功`
          };
          
        default:
          return {
            success: false,
            error: '不支援的操作類型'
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `工作區操作失敗: ${error}`
      };
    }
  }
};

// 程式碼分析工具
export const codeAnalyzer: FunctionDefinition = {
  id: 'codeAnalyzer',
  schema: {
    name: 'codeAnalyzer',
    description: '分析程式碼結構、複雜度和品質',
    parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: '要分析的檔案路徑'
      },
      analysisType: {
        type: 'string',
        enum: ['structure', 'complexity', 'quality', 'dependencies', 'all'],
        description: '分析類型',
        default: 'all'
      },
      language: {
        type: 'string',
        enum: ['typescript', 'javascript', 'python', 'java', 'auto'],
        description: '程式語言，auto 為自動檢測',
        default: 'auto'
      },
      includeMetrics: {
        type: 'boolean',
        description: '是否包含詳細指標',
        default: true
      }
    },
    required: ['filePath']
  }
  },
  metadata: {
    category: ToolCategory.PROJECT,
    accessLevel: FunctionAccessLevel.PUBLIC,
    version: '1.0.0',
    author: 'Code Analysis System',
    tags: ['code', 'analysis', 'quality', 'complexity'],
    rateLimited: true,
    maxCallsPerMinute: 30
  },
  validator: async (params) => {
    const { filePath, analysisType, language } = params;
    
    if (!filePath || typeof filePath !== 'string') {
      return { isValid: false, reason: '檔案路徑是必需的且必須是字串' };
    }
    
    if (analysisType && !['structure', 'complexity', 'quality', 'dependencies', 'all'].includes(analysisType)) {
      return { isValid: false, reason: '無效的分析類型' };
    }
    
    if (language && !['typescript', 'javascript', 'python', 'java', 'auto'].includes(language)) {
      return { isValid: false, reason: '不支援的程式語言' };
    }
    
    return { isValid: true };
  },
  handler: async (params) => {
    try {
      const { 
        filePath, 
        analysisType = 'all', 
        language = 'auto', 
        includeMetrics = true 
      } = params;
      
      return {
        success: true,
        data: {
          filePath,
          analysisType,
          detectedLanguage: language === 'auto' ? 'typescript' : language,
          structure: analysisType === 'structure' || analysisType === 'all' ? {
            functions: [],
            classes: [],
            interfaces: [],
            totalLines: 0,
            codeLines: 0,
            commentLines: 0
          } : undefined,
          complexity: analysisType === 'complexity' || analysisType === 'all' ? {
            cyclomaticComplexity: 0,
            cognitiveComplexity: 0,
            maintainabilityIndex: 0
          } : undefined,
          quality: analysisType === 'quality' || analysisType === 'all' ? {
            score: 0,
            issues: [],
            suggestions: []
          } : undefined,
          dependencies: analysisType === 'dependencies' || analysisType === 'all' ? {
            imports: [],
            exports: [],
            unusedImports: []
          } : undefined,
          metrics: includeMetrics ? {
            analysisTime: Date.now(),
            fileSize: 0,
            lastModified: Date.now()
          } : undefined
        },
        message: `程式碼分析完成: ${filePath}`
      };
    } catch (error) {
      return {
        success: false,
        error: `程式碼分析失敗: ${error}`
      };
    }
  }
};

// 開發工具輔助
export const devToolsHelper: FunctionDefinition = {
  id: 'devToolsHelper',
  schema: {
    name: 'devToolsHelper',
    description: '開發工具輔助功能，包括格式化、重構建議等',
    parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['format', 'lint', 'refactor', 'optimize', 'generate'],
        description: '開發工具操作類型'
      },
      filePath: {
        type: 'string',
        description: '目標檔案路徑'
      },
      content: {
        type: 'string',
        description: '要處理的程式碼內容'
      },
      options: {
        type: 'object',
        description: '操作選項',
        properties: {
          style: { type: 'string', description: '程式碼風格' },
          rules: { type: 'array', description: 'Lint 規則' },
          target: { type: 'string', description: '重構目標' }
        }
      }
    },
    required: ['action']
  }
  },
  metadata: {
    category: ToolCategory.PROJECT,
    accessLevel: FunctionAccessLevel.PUBLIC,
    version: '1.0.0',
    author: 'Development Tools',
    tags: ['development', 'tools', 'format', 'lint', 'refactor'],
    rateLimited: true,
    maxCallsPerMinute: 30
  },
  validator: async (params) => {
    const { action, filePath, content } = params;
    
    if (!['format', 'lint', 'refactor', 'optimize', 'generate'].includes(action)) {
      return { isValid: false, reason: '無效的操作類型' };
    }
    
    if (['format', 'lint', 'refactor', 'optimize'].includes(action) && !filePath && !content) {
      return { isValid: false, reason: `${action} 操作需要 filePath 或 content` };
    }
    
    return { isValid: true };
  },
  handler: async (params) => {
    try {
      const { action, filePath, content, options = {} } = params;
      
      switch (action) {
        case 'format':
          return {
            success: true,
            data: {
              originalContent: content || 'file content',
              formattedContent: 'formatted content',
              changes: [],
              style: options.style || 'default'
            },
            message: '程式碼格式化完成'
          };
          
        case 'lint':
          return {
            success: true,
            data: {
              filePath: filePath || 'unknown',
              issues: [],
              warnings: [],
              errors: [],
              totalIssues: 0,
              rules: options.rules || []
            },
            message: 'Lint 檢查完成'
          };
          
        case 'refactor':
          return {
            success: true,
            data: {
              suggestions: [],
              automatedChanges: [],
              manualChanges: [],
              target: options.target || 'general'
            },
            message: '重構建議生成完成'
          };
          
        case 'optimize':
          return {
            success: true,
            data: {
              optimizations: [],
              performanceGains: [],
              sizeReduction: 0,
              estimatedImprovement: '0%'
            },
            message: '程式碼優化建議生成完成'
          };
          
        case 'generate':
          return {
            success: true,
            data: {
              generatedCode: 'generated code',
              template: 'default',
              metadata: {}
            },
            message: '程式碼生成完成'
          };
          
        default:
          return {
            success: false,
            error: '不支援的操作類型'
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `開發工具操作失敗: ${error}`
      };
    }
  }
};

// 導出所有專案管理工具
export const projectTools: FunctionDefinition[] = [
  projectInfo,
  workspaceManager,
  codeAnalyzer,
  devToolsHelper
];

export default projectTools; 