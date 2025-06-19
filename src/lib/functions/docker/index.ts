/**
 * Docker 相關 OpenAI Function Call 定義
 */

import { 
  FunctionDefinition, 
  ToolCategory, 
  FunctionAccessLevel 
} from '../types';
import type { OpenAIFunctionSchema } from '../categories';
import { createDockerToolkit, DockerContext, DockerToolkit } from '../../docker/tools';
import { 
  getDockerContextByName, 
  getDockerContextById, 
  createDockerContextFromUrl,
  createDefaultDockerContext,
  extractProjectFromUrl 
} from '../../docker/docker-context-config';

/**
 * Docker 工具函數集合
 * 所有操作都在 Docker 容器內執行，與宿主機完全隔離
 */

// 工具調用緩存
const toolCallCache = new Map<string, { 
  result: any; 
  timestamp: number; 
  callCount: number;
}>();

const CACHE_EXPIRY_MS = 30000; // 30秒緩存
const MAX_SAME_CALL_COUNT = 2; // 最多允許相同調用2次
const MIN_CALL_INTERVAL_MS = 10000; // 最小調用間隔 10秒

/**
 * 安全工具調用包裝器
 */
async function safeToolCall<T>(
  toolName: string,
  parameters: any,
  handler: () => Promise<T>
): Promise<T> {
  const cacheKey = `${toolName}:${JSON.stringify(parameters)}`;
  const now = Date.now();
  
  // 檢查緩存
  const cached = toolCallCache.get(cacheKey);
  if (cached) {
    const isExpired = (now - cached.timestamp) > CACHE_EXPIRY_MS;
    
    if (!isExpired) {
      // 如果是完全相同的調用且在緩存期內，直接返回緩存結果
      console.log(`📦 [CACHE HIT] 使用緩存結果: ${toolName}`, { 
        cacheKey,
        callCount: cached.callCount,
        timeSinceCache: now - cached.timestamp
      });
      return cached.result;
    } else {
      // 緩存已過期，清除
      toolCallCache.delete(cacheKey);
      console.log(`🗑️ [CACHE EXPIRED] 清除過期緩存: ${toolName}`, { cacheKey });
    }
  }
  
  // 檢查調用頻率 - 針對相同工具名稱（不考慮參數）
  const toolCallPattern = toolName;
  const recentCalls = Array.from(toolCallCache.entries())
    .filter(([key, cache]) => {
      const keyParts = key.split(':');
      const cachedToolName = keyParts[0];
      const isRecentCall = (now - cache.timestamp) < MIN_CALL_INTERVAL_MS;
      return cachedToolName === toolCallPattern && isRecentCall;
    });
  
  if (recentCalls.length >= MAX_SAME_CALL_COUNT) {
    const oldestCall = Math.min(...recentCalls.map(([_, cache]) => cache.timestamp));
    const waitTime = MIN_CALL_INTERVAL_MS - (now - oldestCall);
    
    if (waitTime > 0) {
      console.log(`🚨 [CIRCUIT BREAKER] 阻止頻繁調用: ${toolName}`, { 
        recentCallCount: recentCalls.length,
        waitTime,
        cacheKey
      });
      throw new Error(`⛔ 工具調用頻率過高: ${toolName} - 請等待 ${Math.ceil(waitTime/1000)} 秒後再試`);
    }
  }
  
  try {
    console.log(`🔧 [TOOL CALL] 執行工具: ${toolName}`, { parameters, cacheKey });
    
    // 執行實際的工具調用
    const result = await handler();
    
    // 緩存結果
    toolCallCache.set(cacheKey, {
      result,
      timestamp: now,
      callCount: (cached?.callCount || 0) + 1
    });
    
    console.log(`✅ [TOOL SUCCESS] 工具執行成功: ${toolName}`, { 
      resultType: typeof result,
      cacheKey 
    });
    
    return result;
  } catch (error) {
    console.error(`❌ [TOOL ERROR] 工具調用失敗: ${toolName}`, { 
      parameters, 
      error: error instanceof Error ? error.message : error,
      cacheKey
    });
    
    // 對於失敗的調用，也要記錄以防止重複嘗試
    toolCallCache.set(cacheKey, {
      result: { error: error instanceof Error ? error.message : 'Unknown error', success: false },
      timestamp: now,
      callCount: (cached?.callCount || 0) + 1
    });
    
    throw error;
  }
}

// Helper function to get the real Docker toolkit for a given project.
async function getRealDockerToolkit(context: any): Promise<DockerToolkit> {
  let dockerContext: DockerContext | null = null;
  
  console.log(`[getRealDockerToolkit] 開始獲取 Docker 工具包，context:`, context);

  // 1. 嘗試從 context 中獲取專案資訊
  if (context) {
    // 檢查是否是 DockerContext 物件
    if (context.containerId && context.containerName) {
      console.log(`[getRealDockerToolkit] 使用已有的 DockerContext:`, {
        containerId: context.containerId,
        containerName: context.containerName,
        workingDirectory: context.workingDirectory
      });
      dockerContext = context as DockerContext;
    }
    // 檢查是否有 URL 資訊
    else if (context.url) {
      console.log(`[getRealDockerToolkit] 從 URL 創建 Docker 上下文: ${context.url}`);
      dockerContext = await createDockerContextFromUrl(context.url);
    }
    // 檢查是否有專案名稱
    else if (context.projectName) {
      console.log(`[getRealDockerToolkit] 根據專案名稱查找容器: ${context.projectName}`);
      dockerContext = await getDockerContextByName(context.projectName);
    }
    // 檢查是否有專案 ID
    else if (context.projectId) {
      console.log(`[getRealDockerToolkit] 根據專案 ID 查找容器: ${context.projectId}`);
      const dockerContextByName = await getDockerContextByName(context.projectId);
      if (dockerContextByName) {
        dockerContext = dockerContextByName;
      } else {
        dockerContext = await getDockerContextById(context.projectId);
      }
    }
  }

  // 2. 嘗試從環境變數或全域狀態中獲取當前專案資訊
  if (!dockerContext) {
    console.log(`[getRealDockerToolkit] 嘗試從全域狀態獲取專案資訊`);
    
    // 檢查是否在瀏覽器環境且有 window.location
    if (typeof window !== 'undefined' && window.location) {
      const currentUrl = window.location.href;
      console.log(`[getRealDockerToolkit] 從當前 URL 獲取專案: ${currentUrl}`);
      dockerContext = await createDockerContextFromUrl(currentUrl);
    }
    
    // 檢查 Next.js 路由資訊（在 API 路由中）
    if (!dockerContext && typeof process !== 'undefined' && process.env) {
      const currentProject = process.env.CURRENT_PROJECT_ID || process.env.PROJECT_NAME;
      if (currentProject) {
        console.log(`[getRealDockerToolkit] 從環境變數獲取專案: ${currentProject}`);
        dockerContext = await getDockerContextByName(currentProject);
      }
    }
  }

  // 3. 如果仍然沒有找到，使用預設容器
  if (!dockerContext) {
    console.log(`[getRealDockerToolkit] 使用預設 Docker 上下文`);
    dockerContext = await createDefaultDockerContext();
  }

  // 4. 最終檢查
  if (!dockerContext) {
    console.error(`[getRealDockerToolkit] 無法獲取 Docker 上下文`);
    throw new Error('無法確定專案上下文 (Project context is not available).');
  }

  console.log(`[getRealDockerToolkit] 成功獲取 Docker 上下文:`, {
    containerId: dockerContext.containerId,
    containerName: dockerContext.containerName,
    workingDirectory: dockerContext.workingDirectory,
    status: dockerContext.status
  });

  // 提取專案名稱（用於傳遞給工具包）
  const projectName = extractProjectNameFromContext(dockerContext);
  
  return createDockerToolkit(dockerContext, projectName);
}

/**
 * 從 Docker 上下文中提取專案名稱
 */
function extractProjectNameFromContext(dockerContext: DockerContext): string | undefined {
  // 嘗試從工作目錄中提取
  if (dockerContext.workingDirectory) {
    const match = dockerContext.workingDirectory.match(/\/app\/workspace\/([^\/]+)/);
    if (match) {
      return match[1];
    }
  }
  
  // 嘗試從容器名稱中提取
  if (dockerContext.containerName) {
    const match = dockerContext.containerName.match(/^ai-web-ide-(.+?)-\d+$/);
    if (match) {
      return match[1].replace(/-/g, '_');
    }
  }
  
  return undefined;
}

/**
 * 在Docker容器內啟動開發伺服器
 */
export async function docker_start_dev_server(context?: any): Promise<{ 
  success: boolean; 
  message?: string; 
  url?: string; 
  error?: string;
  containerOutput?: string;
}> {
  try {
    const dockerToolkit = await getRealDockerToolkit(context);
    const result = await dockerToolkit.devServer.startDevServer();
    
    return {
      success: result.success,
      message: result.message,
      url: result.data?.url,
      error: result.error,
      containerOutput: result.data?.containerOutput || result.containerOutput
    };
  } catch (error) {
    return {
      success: false,
      error: `啟動Docker容器內開發伺服器失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * 在Docker容器內重啟開發伺服器
 */
export async function docker_restart_dev_server(reason?: string, context?: any): Promise<{ 
  success: boolean; 
  message?: string; 
  url?: string; 
  error?: string;
  restartCount?: number;
  containerOutput?: string;
}> {
  try {
    const dockerToolkit = await getRealDockerToolkit(context);
    const result = await dockerToolkit.devServer.restartDevServer(reason);
    
    return {
      success: result.success,
      message: result.message,
      url: result.data?.url,
      error: result.error,
      restartCount: result.data?.restartCount,
      containerOutput: result.data?.containerOutput || result.containerOutput
    };
  } catch (error) {
    return {
      success: false,
      error: `重啟Docker容器內開發伺服器失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * 檢查Docker容器內開發伺服器狀態
 */
export async function docker_check_dev_server_status(context?: any): Promise<{ 
  success: boolean; 
  isRunning: boolean;
  pid?: string;
  port?: string;
  url?: string;
  message?: string; 
  error?: string;
}> {
  try {
    const dockerToolkit = await getRealDockerToolkit(context);
    const result = await dockerToolkit.devServer.checkDevServerStatus();
    
    return {
      success: result.success,
      isRunning: result.data?.isRunning || false,
      pid: result.data?.pid,
      port: result.data?.port,
      url: result.data?.url,
      message: result.message,
      error: result.error
    };
  } catch (error) {
    return {
      success: false,
      isRunning: false,
      error: `檢查Docker容器內開發伺服器狀態失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * 終止Docker容器內開發伺服器
 */
export async function docker_kill_dev_server(context?: any): Promise<{ 
  success: boolean; 
  message?: string; 
  error?: string;
  containerOutput?: string;
}> {
  try {
    const dockerToolkit = await getRealDockerToolkit(context);
    const result = await dockerToolkit.devServer.killDevServer();
    
    return {
      success: result.success,
      message: result.message,
      error: result.error,
      containerOutput: result.containerOutput
    };
  } catch (error) {
    return {
      success: false,
      error: `終止Docker容器內開發伺服器失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Docker ls - 列出目錄內容（標準 Unix ls 命令格式）
 */
export async function docker_ls(
  parameters: { 
    path?: string;     // 目錄路徑，預設為當前目錄
    long?: boolean;    // -l, 長格式顯示
    all?: boolean;     // -a, 顯示隱藏檔案
    recursive?: boolean; // -R, 遞迴列出
    human?: boolean;   // -h, 人類可讀的檔案大小
  } = {}, 
  context?: any
): Promise<{ 
  success: boolean; 
  output?: string; 
  files?: string[];
  message?: string; 
  error?: string;
  containerOutput?: string;
}> {
  try {
    const { path = '.', long = false, all = false, recursive = false, human = false } = parameters;
    
    console.log(`[docker_ls] 執行 ls 命令:`, { path, long, all, recursive, human });
    
    const dockerToolkit = await getRealDockerToolkit(context);
    
    // 構建 ls 命令參數
    const options = {
      showHidden: all,
      recursive: recursive,
      useTree: false
    };
    
    const result = await dockerToolkit.fileSystem.listDirectory(path, options);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || `ls: cannot access '${path}': No such file or directory`
      };
    }
    
    // 格式化輸出，模擬真實的 ls 命令
    let output: string;
    const files = result.data || [];
    
    if (long) {
      // -l 長格式
      output = files.map(file => {
        // 模擬 ls -l 格式：權限 連結數 用戶 群組 大小 日期 檔名
        return `drwxr-xr-x 1 user user 4096 Jan 1 12:00 ${file}`;
      }).join('\n');
    } else {
      // 一般格式，多列顯示
      output = files.join('  ');
    }
    
    console.log(`[docker_ls] 成功列出 ${files.length} 個項目`);
    
    return {
      success: true,
      output,
      files,
      message: `Listed ${files.length} items in ${path}`,
      containerOutput: result.containerOutput
    };
  } catch (error) {
    console.error(`[docker_ls] 執行錯誤:`, error);
    return {
      success: false,
      error: `ls: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Docker tree - 顯示目錄樹狀結構（標準 Unix tree 命令格式）
 */
export async function docker_tree(
  parameters: { 
    path?: string;     // 目錄路徑，預設為當前目錄
    depth?: number;    // -L, 限制顯示深度
    all?: boolean;     // -a, 顯示隱藏檔案
    dirOnly?: boolean; // -d, 只顯示目錄
    fileSize?: boolean; // -s, 顯示檔案大小
  } = {}, 
  context?: any
): Promise<{ 
  success: boolean; 
  output?: string; 
  message?: string; 
  error?: string;
  containerOutput?: string;
}> {
  try {
    const { path = '.', depth, all = false, dirOnly = false, fileSize = false } = parameters;
    
    console.log(`[docker_tree] 執行 tree 命令:`, { path, depth, all, dirOnly, fileSize });
    
    const dockerToolkit = await getRealDockerToolkit(context);
    const result = await dockerToolkit.fileSystem.showDirectoryTree(path, depth);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || `tree: ${path}: No such file or directory`
      };
    }
    
    let output = result.data || '';
    
    // 如果需要過濾隱藏檔案
    if (!all) {
      const lines = output.split('\n');
      output = lines.filter(line => !line.includes('/.')).join('\n');
    }
    
    // 添加標準 tree 命令的統計資訊
    const lines = output.split('\n').filter(line => line.trim());
    const dirCount = lines.filter(line => line.includes('/')).length;
    const fileCount = lines.length - dirCount;
    
    output += `\n\n${dirCount} directories, ${fileCount} files`;
    
    console.log(`[docker_tree] 成功顯示樹狀結構`);
    
    return {
      success: true,
      output,
      message: `Tree view of ${path}`,
      containerOutput: result.containerOutput
    };
  } catch (error) {
    console.error(`[docker_tree] 執行錯誤:`, error);
    return {
      success: false,
      error: `tree: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Docker pwd - 顯示當前工作目錄
 */
export async function docker_pwd(context?: any): Promise<{ 
  success: boolean; 
  output?: string; 
  message?: string; 
  error?: string;
}> {
  try {
    console.log(`[docker_pwd] 獲取當前工作目錄`);
    
    const dockerToolkit = await getRealDockerToolkit(context);
    
    // 從 Docker 上下文獲取工作目錄
    const workingDir = dockerToolkit.dockerContext.workingDirectory || '/app';
    
    return {
      success: true,
      output: workingDir,
      message: `Current working directory: ${workingDir}`
    };
  } catch (error) {
    console.error(`[docker_pwd] 執行錯誤:`, error);
    return {
      success: false,
      error: `pwd: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * 保持向後兼容的 docker_list_directory
 * @deprecated 使用 docker_ls 替代
 */
export async function docker_list_directory(
  parameters: { dirPath?: string; recursive?: boolean; showHidden?: boolean; useTree?: boolean } | string, 
  context?: any
): Promise<{ 
  success: boolean; 
  files?: string[]; 
  message?: string; 
  error?: string;
  containerOutput?: string;
}> {
  console.warn('[docker_list_directory] 此函數已棄用，請使用 docker_ls 替代');
  
  // 轉換參數格式到新的 docker_ls
  let lsParams: Parameters<typeof docker_ls>[0] = {};
  
  if (typeof parameters === 'string') {
    lsParams.path = parameters;
  } else if (parameters && typeof parameters === 'object') {
    lsParams = {
      path: parameters.dirPath || '.',
      all: parameters.showHidden,
      recursive: parameters.recursive
    };
  }
  
  const result = await docker_ls(lsParams, context);
  
  return {
    success: result.success,
    files: result.files,
    message: result.message,
    error: result.error,
    containerOutput: result.containerOutput
  };
}

/**
 * 讀取Docker容器內檔案
 */
export async function docker_read_file(filePath: string, context?: any): Promise<{ 
  success: boolean; 
  content?: string; 
  message?: string; 
  error?: string;
}> {
  try {
    const dockerToolkit = await getRealDockerToolkit(context);
    const result = await dockerToolkit.fileSystem.readFile(filePath);
    
    return {
      success: result.success,
      content: result.data,
      message: result.message,
      error: result.error
    };
  } catch (error) {
    return {
      success: false,
      error: `讀取Docker容器內檔案失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * 寫入檔案到Docker容器內
 */
export async function docker_write_file(filePath: string, content: string, context?: any): Promise<{ 
  success: boolean; 
  message?: string; 
  error?: string;
  containerOutput?: string;
}> {
  try {
    const dockerToolkit = await getRealDockerToolkit(context);
    const result = await dockerToolkit.fileSystem.writeFile(filePath, content);
    
    return {
      success: result.success,
      message: result.message,
      error: result.error,
      containerOutput: result.data
    };
  } catch (error) {
    return {
      success: false,
      error: `寫入Docker容器內檔案失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * 讀取Docker容器內日誌
 */
export async function docker_read_logs(options: {
  lines?: number;
  logFile?: string;
  keyword?: string;
} = {}, context?: any): Promise<{ 
  success: boolean; 
  logs?: string[]; 
  message?: string; 
  error?: string;
  containerOutput?: string;
}> {
  try {
    const dockerToolkit = await getRealDockerToolkit(context);
    const result = await dockerToolkit.logMonitor.readLogTail(options);
    
    return {
      success: result.success,
      logs: result.data,
      message: result.message,
      error: result.error,
      containerOutput: result.containerOutput
    };
  } catch (error) {
    return {
      success: false,
      error: `讀取Docker容器內日誌失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * 搜尋Docker容器內錯誤日誌
 */
export async function docker_search_error_logs(keyword: string = 'Error', lines: number = 1000, context?: any): Promise<{ 
  success: boolean; 
  errors?: string[]; 
  message?: string; 
  error?: string;
  containerOutput?: string;
}> {
  try {
    const dockerToolkit = await getRealDockerToolkit(context);
    const result = await dockerToolkit.logMonitor.searchErrorLogs(keyword, lines);
    
    return {
      success: result.success,
      errors: result.data,
      message: result.message,
      error: result.error,
      containerOutput: result.containerOutput
    };
  } catch (error) {
    return {
      success: false,
      error: `搜尋Docker容器內錯誤日誌失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * 檢查Docker容器內服務健康狀態
 */
export async function docker_check_health(port: number = 3000, context?: any): Promise<{ 
  success: boolean; 
  status?: 'up' | 'down';
  responseTimeMs?: number;
  containerHealth?: 'healthy' | 'unhealthy' | 'starting';
  message?: string; 
  error?: string;
  containerOutput?: string;
}> {
  try {
    const dockerToolkit = await getRealDockerToolkit(context);
    const result = await dockerToolkit.healthCheck.checkHealth(port);
    
    return {
      success: result.success,
      status: result.data?.status,
      responseTimeMs: result.data?.responseTimeMs,
      containerHealth: result.data?.containerHealth,
      message: result.message,
      error: result.error,
      containerOutput: result.containerOutput
    };
  } catch (error) {
    return {
      success: false,
      error: `檢查Docker容器內健康狀態失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Docker容器內智能監控與自動修復
 */
export async function docker_smart_monitor_and_recover(context?: any): Promise<{ 
  success: boolean; 
  results?: string[]; 
  message?: string; 
  error?: string;
}> {
  try {
    const dockerToolkit = await getRealDockerToolkit(context);
    const result = await dockerToolkit.smartMonitorAndRecover();
    
    return {
      success: result.success,
      results: result.data,
      message: result.message,
      error: result.error
    };
  } catch (error) {
    return {
      success: false,
      error: `Docker容器內智能監控失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * 獲取Docker容器內完整狀態報告
 */
export async function docker_get_full_status_report(context?: any): Promise<{ 
  success: boolean; 
  report?: any; 
  message?: string; 
  error?: string;
}> {
  try {
    const dockerToolkit = await getRealDockerToolkit(context);
    const result = await dockerToolkit.getFullStatusReport();
    
    return {
      success: result.success,
      report: result.data,
      message: result.message,
      error: result.error
    };
  } catch (error) {
    return {
      success: false,
      error: `獲取Docker容器狀態報告失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * 在Docker容器內顯示目錄樹狀結構
 */
export async function docker_show_directory_tree(dirPath: string = '.', maxDepth?: number, context?: any): Promise<{ 
  success: boolean; 
  tree?: string; 
  message?: string; 
  error?: string;
  containerOutput?: string;
}> {
  try {
    const dockerToolkit = await getRealDockerToolkit(context);
    const result = await dockerToolkit.fileSystem.showDirectoryTree(dirPath, maxDepth);
    
    return {
      success: result.success,
      tree: result.data,
      message: result.message,
      error: result.error,
      containerOutput: result.containerOutput
    };
  } catch (error) {
    return {
      success: false,
      error: `顯示Docker容器內目錄樹失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
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
    version: '2.1.0', // Incremented version
    author: 'AI Creator Team',
    tags: ['docker', 'file', 'read'],
    requiresAuth: true,
    rateLimited: true,
    maxCallsPerMinute: 60
  },
  handler: async (parameters: { filePath: string }, context?: any) => {
    return safeToolCall('docker_read_file', parameters, async () => {
      const toolkit = await getRealDockerToolkit(context);
      const result = await toolkit.fileSystem.readFile(parameters.filePath);
      if (!result.success) {
        throw new Error(result.error || `無法讀取檔案: ${parameters.filePath}`);
      }
      return result.data;
    });
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

// Docker ls 命令 - 標準 Unix 格式
export const dockerLs: FunctionDefinition = {
  id: 'docker_ls',
  schema: {
    name: 'docker_ls',
    description: '列出 Docker 容器內目錄內容（標準 Unix ls 命令）',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '目錄路徑（預設為當前目錄 "."）',
          default: '.'
        },
        long: {
          type: 'boolean',
          description: '-l, 使用長格式顯示詳細資訊',
          default: false
        },
        all: {
          type: 'boolean',
          description: '-a, 顯示隱藏檔案（以 . 開頭的檔案）',
          default: false
        },
        recursive: {
          type: 'boolean',
          description: '-R, 遞迴列出子目錄內容',
          default: false
        },
        human: {
          type: 'boolean',
          description: '-h, 以人類可讀格式顯示檔案大小',
          default: false
        }
      }
    }
  },
  metadata: {
    category: ToolCategory.DOCKER,
    accessLevel: FunctionAccessLevel.RESTRICTED,
    version: '3.0.0',
    author: 'AI Creator Team',
    tags: ['docker', 'ls', 'directory', 'unix'],
    requiresAuth: true,
    rateLimited: true,
    maxCallsPerMinute: 100
  },
  handler: async (parameters: { 
    path?: string; 
    long?: boolean; 
    all?: boolean; 
    recursive?: boolean; 
    human?: boolean; 
  }, context?: any) => {
    return safeToolCall('docker_ls', parameters, async () => {
      const result = await docker_ls(parameters, context);
      
      if (!result.success) {
        throw new Error(result.error || '執行 ls 命令失敗');
      }
      
      console.log(`[dockerLs] ls 命令執行成功:`, { 
        path: parameters.path || '.',
        fileCount: result.files?.length || 0 
      });
      
      // 返回標準 ls 命令輸出格式
      return result.output || result.files?.join('\n') || '';
    });
  }
};

// Docker tree 命令 - 標準 Unix 格式
export const dockerTree: FunctionDefinition = {
  id: 'docker_tree',
  schema: {
    name: 'docker_tree',
    description: '顯示 Docker 容器內目錄樹狀結構（標準 Unix tree 命令）',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '目錄路徑（預設為當前目錄 "."）',
          default: '.'
        },
        depth: {
          type: 'number',
          description: '-L, 限制顯示深度層級',
          minimum: 1,
          maximum: 10
        },
        all: {
          type: 'boolean',
          description: '-a, 顯示隱藏檔案和目錄',
          default: false
        },
        dirOnly: {
          type: 'boolean',
          description: '-d, 只顯示目錄',
          default: false
        },
        fileSize: {
          type: 'boolean',
          description: '-s, 顯示檔案大小',
          default: false
        }
      }
    }
  },
  metadata: {
    category: ToolCategory.DOCKER,
    accessLevel: FunctionAccessLevel.RESTRICTED,
    version: '3.0.0',
    author: 'AI Creator Team',
    tags: ['docker', 'tree', 'directory', 'unix'],
    requiresAuth: true,
    rateLimited: true,
    maxCallsPerMinute: 50
  },
  handler: async (parameters: { 
    path?: string; 
    depth?: number; 
    all?: boolean; 
    dirOnly?: boolean; 
    fileSize?: boolean; 
  }, context?: any) => {
    return safeToolCall('docker_tree', parameters, async () => {
      const result = await docker_tree(parameters, context);
      
      if (!result.success) {
        throw new Error(result.error || '執行 tree 命令失敗');
      }
      
      console.log(`[dockerTree] tree 命令執行成功:`, { 
        path: parameters.path || '.',
        depth: parameters.depth 
      });
      
      return result.output || '';
    });
  }
};

// Docker pwd 命令 - 標準 Unix 格式
export const dockerPwd: FunctionDefinition = {
  id: 'docker_pwd',
  schema: {
    name: 'docker_pwd',
    description: '顯示 Docker 容器內當前工作目錄（標準 Unix pwd 命令）',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  metadata: {
    category: ToolCategory.DOCKER,
    accessLevel: FunctionAccessLevel.RESTRICTED,
    version: '3.0.0',
    author: 'AI Creator Team',
    tags: ['docker', 'pwd', 'directory', 'unix'],
    requiresAuth: true,
    rateLimited: true,
    maxCallsPerMinute: 200
  },
  handler: async (parameters: {}, context?: any) => {
    return safeToolCall('docker_pwd', parameters, async () => {
      const result = await docker_pwd(context);
      
      if (!result.success) {
        throw new Error(result.error || '執行 pwd 命令失敗');
      }
      
      console.log(`[dockerPwd] pwd 命令執行成功:`, { output: result.output });
      
      return result.output || '';
    });
  }
};

// 修改 docker_list_directory 為相容性包裝器（已棄用）
export const dockerListDirectory: FunctionDefinition = {
  id: 'docker_list_directory',
  schema: {
    name: 'docker_list_directory',
    description: '列出 Docker 容器內目錄的內容（已棄用，請使用 docker_ls）',
    parameters: {
      type: 'object',
      properties: {
        dirPath: {
          type: 'string',
          description: '要列出的目錄路徑（相對於專案根目錄，預設為 "."）'
        }
      }
    }
  },
  metadata: {
    category: ToolCategory.DOCKER,
    accessLevel: FunctionAccessLevel.RESTRICTED,
    version: '2.3.0',
    author: 'AI Creator Team',
    tags: ['docker', 'directory', 'list', 'deprecated'],
    requiresAuth: true,
    rateLimited: true,
    maxCallsPerMinute: 60,
    deprecated: true
  },
  handler: async (parameters: { dirPath?: string }, context?: any) => {
    return safeToolCall('docker_list_directory', parameters, async () => {
      console.warn('[docker_list_directory] 此工具已棄用，建議使用 docker_ls');
      
      const result = await docker_list_directory(parameters, context);
      
      if (!result.success) {
        throw new Error(result.error || '無法列出目錄');
      }
      
      return result.files || [];
    });
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
    version: '2.1.0', // Incremented version
    author: 'AI Creator Team',
    tags: ['docker', 'file', 'write'],
    requiresAuth: true,
    rateLimited: true,
    maxCallsPerMinute: 30
  },
  handler: async (parameters: { filePath: string; content: string }, context?: any) => {
    return safeToolCall('docker_write_file', parameters, async () => {
      const toolkit = await getRealDockerToolkit(context);
      const result = await toolkit.fileSystem.writeFile(parameters.filePath, parameters.content);
      if (!result.success) {
          throw new Error(result.error || `無法寫入檔案: ${parameters.filePath}`);
      }
      return result.data;
    });
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

// Docker 檢查路徑存在 (This can be implemented via listDirectory or readFile)
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
    version: '2.1.0', // Incremented version
    author: 'AI Creator Team',
    tags: ['docker', 'path', 'exists'],
    requiresAuth: true,
    rateLimited: true,
    maxCallsPerMinute: 100
  },
  handler: async (parameters: { path: string }, context?: any) => {
    return safeToolCall('docker_check_path_exists', parameters, async () => {
      const toolkit = await getRealDockerToolkit(context);
      // A simple check can be trying to read the file or list the directory
      // For simplicity, we can use readFile and check for success.
      // A more robust implementation might be needed.
      const result = await toolkit.fileSystem.readFile(parameters.path);
      // If it's a directory, readFile will fail. Let's try listDirectory.
      if (!result.success) {
          const dirResult = await toolkit.fileSystem.listDirectory(parameters.path);
          return dirResult.success;
      }
      return result.success;
    });
  }
};

// Docker 獲取專案資訊 (This can be implemented by reading package.json)
export const dockerGetProjectInfo: FunctionDefinition = {
    id: 'docker_get_project_info',
    schema: {
        name: 'docker_get_project_info',
        description: '獲取 Docker 容器內專案的資訊 (例如從 package.json)',
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    metadata: {
        category: ToolCategory.DOCKER,
        accessLevel: FunctionAccessLevel.RESTRICTED,
        version: '2.1.0',
        author: 'AI Creator Team',
        tags: ['docker', 'project', 'info'],
        requiresAuth: true
    },
    handler: async (parameters: {}, context?: any) => {
        return safeToolCall('docker_get_project_info', parameters, async () => {
            const toolkit = await getRealDockerToolkit(context);
            const result = await toolkit.fileSystem.readFile('package.json');
            if (!result.success || !result.data) {
                throw new Error(result.error || '無法讀取 package.json');
            }
            return JSON.parse(result.data);
        });
    }
};

// 導出所有 Docker 相關的 FunctionDefinition - 更新版本
export const dockerFunctions: FunctionDefinition[] = [
  dockerReadFile,
  dockerLs,        // 新的標準 ls 命令
  dockerTree,      // 新的標準 tree 命令  
  dockerPwd,       // 新的標準 pwd 命令
  dockerWriteFile,
  dockerCheckPathExists,
  dockerGetProjectInfo,
  dockerListDirectory, // 保持向後相容，但標記為已棄用
];

/**
 * 獲取所有 Docker 相關的 OpenAPI Function Schema
 * @returns {OpenAIFunctionSchema[]}
 */
export function getDockerFunctionSchemas(): OpenAIFunctionSchema[] {
  return dockerFunctions.map(fn => fn.schema);
}

/**
 * 獲取所有 Docker 相關的 Function 名稱
 * @returns {string[]}
 */
export function getDockerFunctionNames(): string[] {
  return dockerFunctions.map(fn => fn.schema.name);
} 