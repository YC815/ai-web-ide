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
  normalizeProjectName,
  createDefaultDockerContext
} from '../../docker/docker-context-config';
import { createToolLogger } from '../../logger';
import { ExecutionContext } from './types';

/**
 * Docker 工具函數集合
 * 所有操作都在 Docker 容器內執行，與宿主機完全隔離
 */

// 工具調用緩存
const toolCallCache = new Map<string, {
  result: unknown;
  timestamp: number;
  callCount: number;
}>();

const MAX_SAME_CALL_COUNT = 3; // 每個工具每分鐘最多調用3次（相同參數）
const MIN_CALL_INTERVAL_MS = 2000; // 每次調用間隔至少2秒
const CACHE_EXPIRE_MS = 60000; // 緩存過期時間：1分鐘

/**
 * 安全工具調用包裝器，提供防爆閥機制
 */
async function safeToolCall<T>(
  toolName: string,
  parameters: unknown,
  handler: () => Promise<T>
): Promise<T> {
  const cacheKey = `${toolName}:${JSON.stringify(parameters)}`;
  const now = Date.now();

  // 清理過期緩存
  for (const [key, cache] of toolCallCache.entries()) {
    if (now - cache.timestamp > CACHE_EXPIRE_MS) {
      toolCallCache.delete(key);
    }
  }

  // 檢查是否頻繁調用相同工具
  const allCalls = Array.from(toolCallCache.entries()).filter(([key]) =>
    key.startsWith(`${toolName}:`)
  );

  const recentCalls = allCalls.filter(([, cache]) =>
    now - cache.timestamp < MIN_CALL_INTERVAL_MS
  );

  // 檢查相同參數的調用頻率
  const exactSameCalls = allCalls.filter(([key, cache]) =>
    key === cacheKey && now - cache.timestamp < CACHE_EXPIRE_MS
  );

  if (exactSameCalls.length >= MAX_SAME_CALL_COUNT) {
    const cachedResult = exactSameCalls[exactSameCalls.length - 1][1];
    console.warn(`[safeToolCall] 工具 ${toolName} 調用過於頻繁，返回緩存結果`, {
      callCount: exactSameCalls.length,
      cacheAge: now - cachedResult.timestamp
    });
    return cachedResult.result as T;
  }

  if (recentCalls.length >= MAX_SAME_CALL_COUNT) {
    const oldestCall = Math.min(...recentCalls.map(([, cache]) => cache.timestamp));
    const waitTime = MIN_CALL_INTERVAL_MS - (now - oldestCall);

    if (waitTime > 0) {
      console.warn(`[safeToolCall] 工具 ${toolName} 調用頻率過高，等待 ${waitTime}ms`, {
        recentCallCount: recentCalls.length,
        parameters
      });
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  try {
    console.log(`[safeToolCall] 執行工具: ${toolName}`, { parameters });

    const result = await handler();

    // 緩存成功結果
    const existingCache = toolCallCache.get(cacheKey);
    toolCallCache.set(cacheKey, {
      result,
      timestamp: now,
      callCount: (existingCache?.callCount || 0) + 1
    });

    console.log(`[safeToolCall] 工具 ${toolName} 執行成功`);
    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[safeToolCall] 工具 ${toolName} 執行失敗:`, errorMessage);

    // 對於參數驗證錯誤，不緩存
    if (errorMessage.includes('參數驗證失敗')) {
      throw error;
    }

    // 緩存錯誤結果以避免重複嘗試
    toolCallCache.set(cacheKey, {
      result: error,
      timestamp: now,
      callCount: 1
    });

    throw error;
  }
}

// Helper function to get the real Docker toolkit for a given project.
async function getRealDockerToolkit(context: unknown): Promise<DockerToolkit> {
  console.log(`[getRealDockerToolkit] 開始獲取 Docker 工具包，context:`, context);

  try {
    let dockerContext: DockerContext | null = null;

    if (context && typeof context === 'object') {
      const ctx = context as Record<string, unknown>;

      if (ctx.containerId && typeof ctx.containerId === 'string') {
        console.log(`[getRealDockerToolkit] 使用提供的 containerId: ${ctx.containerId}`);
        dockerContext = await getDockerContextById(ctx.containerId);
      }

      if (!dockerContext && ctx.projectName && typeof ctx.projectName === 'string') {
        const normalizedName = normalizeProjectName(ctx.projectName);
        console.log(`[getRealDockerToolkit] 使用專案名稱查找: ${ctx.projectName} -> ${normalizedName}`);
        dockerContext = await getDockerContextByName(normalizedName);
      }
    }

    // 如果沒有找到上下文，嘗試創建預設的
    if (!dockerContext) {
      console.log(`[getRealDockerToolkit] 嘗試創建預設 Docker 上下文`);
      dockerContext = await createDefaultDockerContext();
      
      if (!dockerContext) {
        console.error(`[getRealDockerToolkit] 無法創建預設 Docker 上下文`);
        throw new Error('❌ 無法連接到 Docker 容器。請確保：\n1. Docker 正在運行\n2. 有可用的專案容器\n3. 容器狀態正常');
      }
    }

    // 驗證 Docker 上下文的完整性
    if (!dockerContext.containerId || !dockerContext.containerName || !dockerContext.workingDirectory) {
      console.error(`[getRealDockerToolkit] Docker 上下文不完整:`, dockerContext);
      throw new Error('❌ Docker 上下文配置不完整，無法執行容器操作');
    }

    console.log(`[getRealDockerToolkit] 成功獲取 Docker 上下文:`, {
      containerId: dockerContext.containerId,
      containerName: dockerContext.containerName,
      workingDirectory: dockerContext.workingDirectory,
      status: dockerContext.status
    });

    return createDockerToolkit(dockerContext);

  } catch (error) {
    console.error(`[getRealDockerToolkit] 獲取 Docker 工具包失敗:`, error);
    
    // 如果是我們自己拋出的錯誤，直接重新拋出
    if (error instanceof Error && error.message.startsWith('❌')) {
      throw error;
    }
    
    // 對於其他錯誤，包裝成更友好的錯誤訊息
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`❌ Docker 工具初始化失敗: ${errorMessage}`);
  }
}

/**
 * 從 Docker 上下文中提取專案名稱的輔助函數
 * 暫時註釋，未來可能需要使用
 */
// function extractProjectNameFromContext(dockerContext: DockerContext): string | undefined {
//   // 1. 從容器名稱中提取
//   if (dockerContext.containerName) {
//     const match = dockerContext.containerName.match(/ai-dev-(.+)/);
//     if (match) {
//       return match[1];
//     }
//   }

//   // 2. 從工作目錄中提取
//   if (dockerContext.workingDirectory?.includes('/workspace/')) {
//     const parts = dockerContext.workingDirectory.split('/workspace/');
//     if (parts.length > 1) {
//       return parts[1].split('/')[0];
//     }
//   }

//   return undefined;
// }

/**
 * 在Docker容器內啟動開發伺服器
 */
export async function docker_start_dev_server(context?: unknown): Promise<{
  success: boolean;
  message?: string;
  url?: string;
  error?: string;
  containerOutput?: string;
}> {
  return safeToolCall('docker_start_dev_server', {}, async () => {
    const dockerToolkit = await getRealDockerToolkit(context);
    const result = await dockerToolkit.devServer.startDevServer();

    return {
      success: result.success,
      message: result.message,
      url: result.data?.url,
      error: result.error,
      containerOutput: result.data?.containerOutput
    };
  });
}

/**
 * 在Docker容器內重啟開發伺服器
 */
export async function docker_restart_dev_server(reason?: string, context?: unknown): Promise<{
  success: boolean;
  message?: string;
  url?: string;
  error?: string;
  restartCount?: number;
  containerOutput?: string;
}> {
  return safeToolCall('docker_restart_dev_server', { reason }, async () => {
    const dockerToolkit = await getRealDockerToolkit(context);
    const result = await dockerToolkit.devServer.restartDevServer(reason);

    return {
      success: result.success,
      message: result.message,
      url: result.data?.url,
      error: result.error,
      restartCount: result.data?.restartCount,
      containerOutput: result.data?.containerOutput
    };
  });
}

/**
 * 檢查Docker容器內開發伺服器狀態
 */
export async function docker_check_dev_server_status(context?: unknown): Promise<{
  success: boolean;
  isRunning: boolean;
  pid?: string;
  port?: string;
  url?: string;
  message?: string;
  error?: string;
}> {
  return safeToolCall('docker_check_dev_server_status', {}, async () => {
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
  });
}

/**
 * 終止Docker容器內開發伺服器
 */
export async function docker_kill_dev_server(context?: unknown): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  containerOutput?: string;
}> {
  return safeToolCall('docker_kill_dev_server', {}, async () => {
    const dockerToolkit = await getRealDockerToolkit(context);
    const result = await dockerToolkit.devServer.killDevServer();

    return {
      success: result.success,
      message: result.message,
      error: result.error,
      containerOutput: result.containerOutput
    };
  });
}

/**
 * Docker ls - 列出容器內目錄內容
 */
export async function docker_ls(
  parameters: {
    path?: string;     // 目錄路徑，預設為當前目錄
    long?: boolean;    // -l, 長格式顯示
    all?: boolean;     // -a, 顯示隱藏檔案
    recursive?: boolean; // -R, 遞迴列出
    human?: boolean;   // -h, 人類可讀的檔案大小
  } = {},
  context?: unknown
): Promise<{
  success: boolean;
  output?: string;
  files?: string[];
  message?: string;
  error?: string;
  containerOutput?: string;
}> {
  return safeToolCall('docker_ls', parameters, async () => {
    const dockerToolkit = await getRealDockerToolkit(context);

    // 構建 ls 選項
    const options: string[] = [];
    if (parameters.long) options.push('-l');
    if (parameters.all) options.push('-a');
    if (parameters.recursive) options.push('-R');
    if (parameters.human) options.push('-h');

    const targetPath = parameters.path || '.';
    const command = `ls ${options.join(' ')} "${targetPath}"`.trim();

    console.log(`[docker_ls] 執行命令: ${command}`);

    try {
      // 使用 listDirectory 方法 - 強制禁用 tree 功能
      const result = await dockerToolkit.fileSystem.listDirectory(targetPath, {
        recursive: parameters.recursive,
        showHidden: parameters.all,
        useTree: false  // 強制禁用 tree 功能
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          message: '列出目錄失敗'
        };
      }

      const files = result.data || [];
      const output = files.join('\n');

      return {
        success: true,
        output,
        files,
        message: `成功列出 ${files.length} 個項目`,
        containerOutput: result.containerOutput
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        message: '執行 ls 命令失敗'
      };
    }
  });
}

/**
 * Docker tree - 顯示容器內目錄樹狀結構 - 暫時禁用
 */
/*
export async function docker_tree(
  parameters: {
    path?: string;     // 目錄路徑，預設為當前目錄
    depth?: number;    // -L, 限制顯示深度
    all?: boolean;     // -a, 顯示隱藏檔案
    dirOnly?: boolean; // -d, 只顯示目錄
    fileSize?: boolean; // -s, 顯示檔案大小
  } = {},
  context?: unknown
): Promise<{
  success: boolean;
  output?: string;
  message?: string;
  error?: string;
  containerOutput?: string;
}> {
  return safeToolCall('docker_tree', parameters, async () => {
    const dockerToolkit = await getRealDockerToolkit(context);

    const targetPath = parameters.path || '.';
    const maxDepth = parameters.depth;

    console.log(`[docker_tree] 顯示目錄樹: ${targetPath}`, { maxDepth });

    try {
      const result = await dockerToolkit.fileSystem.showDirectoryTree(targetPath, maxDepth);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          message: '顯示目錄樹失敗'
        };
      }

      return {
        success: true,
        output: result.data,
        message: result.message,
        containerOutput: result.data
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        message: '執行 tree 命令失敗'
      };
    }
  });
}
*/

/**
 * Docker pwd - 顯示當前工作目錄
 */
export async function docker_pwd(context?: unknown): Promise<{
  success: boolean;
  output?: string;
  message?: string;
  error?: string;
}> {
  return safeToolCall('docker_pwd', {}, async () => {
    const dockerToolkit = await getRealDockerToolkit(context);

    // 修復：直接從 Docker 上下文獲取工作目錄
    let workingDir = '/app';
    try {
      // 嘗試從 dockerToolkit 訪問 dockerContext
      const dockerToolkitAny = dockerToolkit as unknown as {
        dockerContext?: DockerContext;
        fileSystem?: { dockerContext?: DockerContext };
        devServer?: { dockerContext?: DockerContext };
      };
      const contextObj = dockerToolkitAny.dockerContext ||
        dockerToolkitAny.fileSystem?.dockerContext ||
        dockerToolkitAny.devServer?.dockerContext;
      if (contextObj?.workingDirectory) {
        workingDir = contextObj.workingDirectory;
      }
    } catch {
      // 使用預設值
    }

    return {
      success: true,
      output: workingDir,
      message: `當前工作目錄: ${workingDir}`
    };
  });
}

/**
 * Docker list directory - 相容性包裝器（已棄用）
 */
export async function docker_list_directory(
  parameters: Record<string, unknown> | string,
  context?: unknown
): Promise<{
  success: boolean;
  files?: string[];
  message?: string;
  error?: string;
  containerOutput?: string;
}> {
  return safeToolCall('docker_list_directory', parameters, async () => {
    console.warn('[docker_list_directory] 此函數已棄用，建議使用 docker_ls');

    const dockerToolkit = await getRealDockerToolkit(context);

    let dirPath = '.';
    let options = {};

    if (typeof parameters === 'string') {
      dirPath = parameters;
    } else if (parameters && typeof parameters === 'object') {
      const params = parameters as Record<string, unknown>;
      // 支援 dirPath（標準）和 path 參數名稱
      dirPath = (params.dirPath as string) || 
                (params.path as string) || 
                '.';
      options = {
        recursive: params.recursive as boolean,
        showHidden: params.showHidden as boolean,
        useTree: params.useTree as boolean
      };
    }

    const result = await dockerToolkit.fileSystem.listDirectory(dirPath, options);

    return {
      success: result.success,
      files: result.data,
      message: result.message,
      error: result.error,
      containerOutput: result.containerOutput
    };
  });
}

/**
 * 在Docker容器內讀取檔案（需安全驗證）- 嚴格模式
 */
export async function docker_read_file(
  parameters: { filePath: string }, 
  context?: unknown
): Promise<{
  success: boolean;
  content?: string;
  message?: string;
  error?: string;
}> {
  return safeToolCall('docker_read_file', parameters, async () => {
    const { filePath } = parameters;

    if (!filePath) {
      throw new Error(`參數驗證失敗：缺少 filePath。收到的參數: ${JSON.stringify(parameters)}`);
    }

    const logger = createToolLogger('docker_read_file');
    logger.info(`讀取檔案: ${filePath}`);

    try {
      const dockerToolkit = await getRealDockerToolkit(context);
      const result = await dockerToolkit.fileSystem.readFile(filePath);
      
      if (result.success) {
        logger.info(`成功讀取檔案: ${filePath}`);
        return {
          success: true,
          content: result.data,
          message: result.message
        };
      } else {
        logger.error(`讀取檔案失敗: ${result.error}`);
        return { success: false, error: result.error, message: result.message };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`執行讀取檔案時發生異常: ${errorMessage}`);
      throw new Error(`執行 docker_read_file 時發生內部錯誤: ${errorMessage}`);
    }
  });
}

/**
 * 寫入檔案到Docker容器內（需安全驗證）- 嚴格模式
 */
export async function docker_write_file(
  parameters: { filePath?: string; content?: string; input?: string; path?: string; file?: string; data?: string; text?: string }, 
  context?: unknown
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  containerOutput?: string;
}> {
  return safeToolCall('docker_write_file', parameters, async () => {
    const logger = createToolLogger('docker_write_file');
    
    // === 第一步：參數清理和標準化 ===
    let filePath: string | undefined;
    let content: string | undefined;
    
    // 提取檔案路徑，支援多種參數名稱
    filePath = parameters.filePath || parameters.path || parameters.file;
    
    // 提取內容，支援多種參數名稱
    content = parameters.content || parameters.input || parameters.data || parameters.text;
    
    logger.info(`[參數標準化] 原始參數: ${JSON.stringify(Object.keys(parameters))}`);
    logger.info(`[參數標準化] 提取到 filePath: ${filePath}`);
    logger.info(`[參數標準化] 提取到 content 類型: ${typeof content}, 長度: ${content?.length || 0}`);
    
    // === 第二步：智能參數修復 ===
    // 如果沒有找到 filePath，但 input 看起來像檔案路徑
    if (!filePath && parameters.input && typeof parameters.input === 'string') {
      // 檢查 input 是否看起來像檔案路徑
      if (parameters.input.match(/\.(tsx?|jsx?|css|html|md|json|js|ts)$/i) && parameters.input.length < 200) {
        filePath = parameters.input;
        content = parameters.content; // 使用 content 作為內容
        logger.info(`[智能修復] 將 input 識別為檔案路徑: ${filePath}`);
      }
    }
    
    // 如果沒有找到 content，但 input 看起來像內容
    if (!content && parameters.input && typeof parameters.input === 'string') {
      // 如果 input 很長或包含程式碼特徵，將其作為內容
      if (parameters.input.length > 50 || 
          parameters.input.includes('import ') || 
          parameters.input.includes('export ') ||
          parameters.input.includes('function ') ||
          parameters.input.includes('<') ||
          parameters.input.includes('{')) {
        content = parameters.input;
        logger.info(`[智能修復] 將 input 識別為檔案內容，長度: ${content.length}`);
      }
    }
    
    // === 第三步：最終驗證 ===
    if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
      const availableParams = Object.keys(parameters).join(', ');
      throw new Error(`❌ 參數錯誤：缺少有效的檔案路徑。
請使用 { "filePath": "路徑", "content": "內容" } 格式。
收到的參數: ${availableParams}
檔案路徑值: ${JSON.stringify(filePath)}`);
    }

    if (content === undefined || content === null) {
      const availableParams = Object.keys(parameters).join(', ');
      throw new Error(`❌ 參數錯誤：缺少檔案內容。
請使用 { "filePath": "${filePath}", "content": "內容" } 格式。
收到的參數: ${availableParams}
內容值: ${JSON.stringify(content)}`);
    }

    // 確保 content 是字串類型
    if (typeof content !== 'string') {
      try {
        content = String(content);
        logger.info(`[類型轉換] 將 content 轉換為字串: ${typeof content}`);
      } catch {
        throw new Error(`❌ 參數錯誤：無法將內容轉換為字串。
內容類型: ${typeof content}
內容值: ${JSON.stringify(content)}`);
      }
    }

    logger.info(`[智能修復] 將 input 識別為檔案內容，長度: ${content.length}`);

    // === 第四步：清理檔案路徑 ===
    filePath = filePath.trim();
    // 移除開頭的 ./ 或 /
    if (filePath.startsWith('./')) {
      filePath = filePath.substring(2);
    } else if (filePath.startsWith('/')) {
      filePath = filePath.substring(1);
    }

    logger.info(`✅ 參數驗證通過 - 檔案: ${filePath}, 內容長度: ${content.length}`);

    // === 第五步：執行寫入操作 ===
    try {
      const dockerToolkit = await getRealDockerToolkit(context);
      const result = await dockerToolkit.fileSystem.writeFile(filePath, content);

      if (result.success) {
        logger.info(`✅ 成功寫入檔案: ${filePath}`);
        return {
          success: true,
          message: `成功寫入檔案：${filePath}（${content.length} 字符）`,
          containerOutput: result.containerOutput || result.data
        };
      } else {
        logger.error(`❌ 寫入檔案失敗: ${result.error}`);
        return {
          success: false,
          error: `寫入檔案失敗：${result.error}`,
          message: `無法寫入檔案：${filePath}`
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`💥 執行寫入檔案時發生異常: ${errorMessage}`);
      throw new Error(`執行 docker_write_file 時發生內部錯誤：${errorMessage}`);
    }
  });
}

export async function docker_read_logs(options: {
  lines?: number;
  logFile?: string;
  keyword?: string;
} = {}, context?: unknown): Promise<{
  success: boolean;
  logs?: string[];
  message?: string;
  error?: string;
  containerOutput?: string;
}> {
  return safeToolCall('docker_read_logs', options, async () => {
    const dockerToolkit = await getRealDockerToolkit(context);
    const result = await dockerToolkit.logMonitor.readLogTail(options);

    return {
      success: result.success,
      logs: result.data,
      message: result.message,
      error: result.error,
      containerOutput: result.containerOutput
    };
  });
}

export async function docker_search_error_logs(keyword: string = 'Error', lines: number = 1000, context?: unknown): Promise<{
  success: boolean;
  errors?: string[];
  message?: string;
  error?: string;
  containerOutput?: string;
}> {
  return safeToolCall('docker_search_error_logs', { keyword, lines }, async () => {
    const dockerToolkit = await getRealDockerToolkit(context);
    const result = await dockerToolkit.logMonitor.searchErrorLogs(keyword, lines);

    return {
      success: result.success,
      errors: result.data,
      message: result.message,
      error: result.error,
      containerOutput: result.containerOutput
    };
  });
}

export async function docker_check_health(port: number = 3000, context?: unknown): Promise<{
  success: boolean;
  status?: 'up' | 'down';
  responseTimeMs?: number;
  containerHealth?: 'healthy' | 'unhealthy' | 'starting';
  message?: string;
  error?: string;
  containerOutput?: string;
}> {
  return safeToolCall('docker_check_health', { port }, async () => {
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
  });
}

export async function docker_smart_monitor_and_recover(context?: unknown): Promise<{
  success: boolean;
  results?: string[];
  message?: string;
  error?: string;
}> {
  return safeToolCall('docker_smart_monitor_and_recover', {}, async () => {
    const dockerToolkit = await getRealDockerToolkit(context);
    const result = await dockerToolkit.smartMonitorAndRecover();

    return {
      success: result.success,
      results: result.data,
      message: result.message,
      error: result.error
    };
  });
}

export async function docker_get_full_status_report(context?: unknown): Promise<{
  success: boolean;
  report?: unknown;
  message?: string;
  error?: string;
}> {
  return safeToolCall('docker_get_full_status_report', {}, async () => {
    const dockerToolkit = await getRealDockerToolkit(context);
    const result = await dockerToolkit.getFullStatusReport();

    return {
      success: result.success,
      report: result.data,
      message: result.message,
      error: result.error
    };
  });
}

/**
 * Docker show directory tree - 顯示目錄樹狀結構 - 暫時禁用
 */
/*
export async function docker_show_directory_tree(dirPath: string = '.', maxDepth?: number, context?: unknown): Promise<{
  success: boolean;
  tree?: string;
  message?: string;
  error?: string;
  containerOutput?: string;
}> {
  return safeToolCall('docker_show_directory_tree', { dirPath, maxDepth }, async () => {
    const dockerToolkit = await getRealDockerToolkit(context);
    const result = await dockerToolkit.fileSystem.showDirectoryTree(dirPath, maxDepth);

    return {
      success: result.success,
      tree: result.data,
      message: result.message,
      error: result.error,
      containerOutput: result.data
    };
  });
}
*/

// Docker 讀取檔案 - 簡化版
export const dockerReadFile: FunctionDefinition = {
  id: 'docker_read_file',
  schema: {
    name: 'docker_read_file',
    description: '讀取 Docker 容器內 /app 目錄中指定檔案的內容。',
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
  metadata: {
    category: ToolCategory.DOCKER,
    accessLevel: FunctionAccessLevel.RESTRICTED,
    version: '4.1.0', // 更新版本號
    author: 'AI Creator Team',
    tags: ['docker', 'file', 'read', 'fixed'],
    requiresAuth: true,
    rateLimited: true,
    maxCallsPerMinute: 50
  },
  handler: async (parameters: Record<string, unknown>, context?: unknown) => {
    return safeToolCall('docker_read_file', parameters, async () => {
      // 參數已在 schema 層被強制統一，不再需要相容性處理
      const result = await docker_read_file({
        filePath: parameters.filePath as string
      }, context);

      if (!result.success) {
        return `讀取失敗: ${result.error || '未知錯誤'}`;
      }
      return result.content || '檔案為空或讀取失敗。';
    });
  },
  validator: async (parameters: unknown) => {
    if (!parameters || typeof parameters !== 'object') {
      return {
        isValid: false,
        reason: '缺少必要參數'
      };
    }

    const params = parameters as { filePath?: unknown };

    if (typeof params.filePath !== 'string' || !params.filePath) {
      return {
        isValid: false,
        reason: '參數 "filePath" 必須是有效的非空字串。'
      };
    }

    return { isValid: true };
  }
};

// Docker ls 命令 - 簡化版，直接執行原始命令
export const dockerLs: FunctionDefinition = {
  id: 'docker_ls',
  schema: {
    name: 'docker_ls',
    description: '在 Docker 容器內執行 ls 命令來列出檔案和目錄。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: ['string', 'null'],
          description: '目錄路徑，預設為當前目錄'
        },
        long: {
          type: ['boolean', 'null'],
          description: '-l, 長格式顯示'
        },
        all: {
          type: ['boolean', 'null'],
          description: '-a, 顯示隱藏檔案'
        },
        recursive: {
          type: ['boolean', 'null'],
          description: '-R, 遞迴列出'
        },
        human: {
          type: ['boolean', 'null'],
          description: '-h, 人類可讀的檔案大小'
        }
      },
      required: []
    }
  },
  metadata: {
    category: ToolCategory.DOCKER,
    accessLevel: FunctionAccessLevel.RESTRICTED,
    version: '4.1.0', // 更新版本號
    author: 'AI Creator Team',
    tags: ['docker', 'ls', 'directory', 'fixed'],
    requiresAuth: true,
    rateLimited: true,
    maxCallsPerMinute: 100
  },
  handler: async (parameters: Record<string, unknown>, context?: unknown) => {
    return safeToolCall('docker_ls', parameters, async () => {
      // 參數已在 schema 層被強制統一，不再需要相容性處理
      const result = await docker_ls({
        path: parameters.path as string,
        long: parameters.long as boolean,
        all: parameters.all as boolean,
        recursive: parameters.recursive as boolean,
        human: parameters.human as boolean,
      }, context);

      if (!result.success) {
        return `錯誤：${result.error}`;
      }
      return result.output || result.files?.join('\n') || '目錄為空或沒有內容。';
    });
  },
  validator: async (parameters: unknown) => {
    if (!parameters || typeof parameters !== 'object') {
      return { isValid: true }; // 允許空參數，使用預設值
    }

    const params = parameters as Record<string, unknown>;

    if (params.path !== undefined && typeof params.path !== 'string') {
      return {
        isValid: false,
        reason: '參數 "path" 必須是字串'
      };
    }

    return { isValid: true };
  }
};

// Docker tree 命令 - 簡化版，直接執行原始命令 - 暫時禁用
/*
export const dockerTree: FunctionDefinition = {
  id: 'docker_tree',
  schema: {
    name: 'docker_tree',
    description: '在 Docker 容器內執行 tree 命令（自動排除 node_modules）。您可以提供任何 tree 命令的參數，例如：. 或 src 或 -L 2 src',
    parameters: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'tree 命令的參數，將原封不動地放到 tree 命令後面。例如：. 或 src 或 -L 2 src',
          default: '.'
        }
      }
    }
  },
  metadata: {
    category: ToolCategory.DOCKER,
    accessLevel: FunctionAccessLevel.RESTRICTED,
    version: '4.0.0', // 新的簡化版本
    author: 'AI Creator Team',
    tags: ['docker', 'tree', 'directory', 'simple'],
    requiresAuth: true,
    rateLimited: true,
    maxCallsPerMinute: 50
  },
  implementation: async (parameters: Record<string, unknown>, context?: unknown) => {
    return safeToolCall('docker_tree', parameters, async () => {
      console.log(`[dockerTree] 執行參數:`, parameters);
      
      // 簡單處理參數：任何東西都直接放到 tree 命令後面
      let treeArgs = '.'; // 預設值
      
      if (typeof parameters === 'string') {
        treeArgs = parameters;
      } else if (parameters.input && typeof parameters.input === 'string') {
        treeArgs = parameters.input as string;
      } else if (parameters.path && typeof parameters.path === 'string') {
        treeArgs = parameters.path as string;
      }
      
      console.log(`[dockerTree] 處理後的參數: ${treeArgs}`);
      
      // 直接執行 tree 命令，自動排除 node_modules
      const command = ['bash', '-c', `tree -I node_modules ${treeArgs} || (echo "安裝 tree 命令中..." && (apk add --no-cache tree || apt-get update && apt-get install -y tree || yum install -y tree) && tree -I node_modules ${treeArgs}) || find ${treeArgs} -name node_modules -prune -o -type f -print | head -50`];
      
      console.log(`[dockerTree] 執行命令: tree -I node_modules ${treeArgs}`);
      
      let containerId: string | undefined;
      
      // 嘗試從 context 獲取容器 ID
      if (context && typeof context === 'object') {
        const ctx = context as Record<string, unknown>;
        if (ctx.containerId && typeof ctx.containerId === 'string') {
          containerId = ctx.containerId;
          console.log(`[dockerTree] 使用 context 中的容器 ID: ${containerId}`);
        } else if (ctx.projectName && typeof ctx.projectName === 'string') {
          // 如果有專案名稱，嘗試獲取對應的容器
          try {
            const dockerContext = getDockerContextByName(ctx.projectName as string);
            if (dockerContext) {
              containerId = dockerContext.containerId;
              console.log(`[dockerTree] 通過專案名稱獲取容器 ID: ${containerId}`);
            }
          } catch (error) {
            console.warn(`[dockerTree] 無法通過專案名稱獲取容器:`, error);
          }
        }
      }
      
      // 如果沒有從 context 獲取到，嘗試使用 dockerToolkit
      if (!containerId) {
        const dockerToolkit = await getRealDockerToolkit(context);
        containerId = (dockerToolkit as any)?.dockerContext?.containerId;
        console.log(`[dockerTree] 從 dockerToolkit 獲取容器 ID: ${containerId}`);
      }
      
      if (!containerId) {
        return {
          success: false,
          error: '無法獲取 Docker 容器 ID',
          message: '請確保在正確的專案上下文中執行此命令'
        };
      }
      
      try {
        // 構建 API URL
        const apiUrl = typeof window !== 'undefined' 
          ? '/api/docker'
          : `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/docker`;
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'exec',
            containerId,
            command,
            workingDirectory: '/app'
          })
        });
        
        const result = await response.json();
        const output = result.stdout || result.stderr || '';
        
        console.log(`[dockerTree] 命令執行結果:`, { success: result.success, output });
        
        return {
          success: result.success,
          output,
          message: result.success ? `成功執行 tree 命令` : `執行失敗: ${result.error}`,
          error: result.success ? undefined : result.error
        };
      } catch (error) {
        const errorMsg = `執行 tree 命令時發生錯誤: ${error instanceof Error ? error.message : String(error)}`;
        console.error('[dockerTree]', errorMsg);
        return {
          success: false,
          error: errorMsg,
          message: '執行 tree 命令失敗'
        };
      }
    });
  }
};
*/

// Docker pwd - 顯示當前工作目錄
export const dockerPwd: FunctionDefinition = {
  id: 'docker_pwd',
  schema: {
    name: 'docker_pwd',
    description: '顯示 Docker 容器內的當前工作目錄',
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
    tags: ['docker', 'pwd', 'path'],
    requiresAuth: true,
    rateLimited: true,
    maxCallsPerMinute: 100
  },
  handler: async (parameters: Record<string, unknown>, context?: unknown) => {
    return safeToolCall('docker_pwd', parameters, async () => {
      return await docker_pwd(context);
    });
  },
  validator: async () => {
    return { isValid: true };
  }
};

// Docker 寫入檔案
export const dockerWriteFile: FunctionDefinition = {
  id: 'docker_write_file',
  schema: {
    name: 'docker_write_file',
    description: '寫入或覆蓋內容到 Docker 容器內的指定檔案。',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '要寫入或覆蓋的檔案的相對路徑，例如 `src/app/page.tsx`。'
        },
        content: {
          type: 'string',
          description: '要寫入的完整檔案內容。'
        }
      },
      required: ['filePath', 'content']
    }
  },
  metadata: {
    category: ToolCategory.DOCKER,
    accessLevel: FunctionAccessLevel.RESTRICTED,
    version: '2.2.0', // 升級版本號
    author: 'AI Creator Team',
    tags: ['docker', 'file', 'write', 'simplified'],
    requiresAuth: true,
    rateLimited: true,
    maxCallsPerMinute: 20
  },
  handler: async (parameters: Record<string, unknown>, context?: unknown) => {
    return safeToolCall('docker_write_file', parameters, async () => {
      console.log(`[dockerWriteFile handler] 收到參數:`, {
        keys: Object.keys(parameters),
        filePath: parameters.filePath,
        contentType: typeof parameters.content,
        contentLength: typeof parameters.content === 'string' ? parameters.content.length : 0,
        input: parameters.input ? 'exists' : 'missing'
      });

      // === 簡化的參數處理邏輯 ===
      let filePath: string | undefined;
      let content: string | undefined;

      // 1. 優先使用標準參數名
      if (parameters.filePath && typeof parameters.filePath === 'string') {
        filePath = parameters.filePath;
      }
      
      if (parameters.content && typeof parameters.content === 'string') {
        content = parameters.content;
      }

      // 2. 如果標準參數不存在，嘗試解析 input（僅當它是 JSON 字串時）
      if ((!filePath || !content) && parameters.input && typeof parameters.input === 'string') {
        try {
          // 嘗試解析 JSON
          const parsed = JSON.parse(parameters.input);
          if (typeof parsed === 'object' && parsed !== null) {
            if (!filePath && parsed.filePath && typeof parsed.filePath === 'string') {
              filePath = parsed.filePath;
              console.log(`[dockerWriteFile handler] 從 JSON input 解析到 filePath: ${filePath}`);
            }
            if (!content && parsed.content && typeof parsed.content === 'string') {
              content = parsed.content;
              console.log(`[dockerWriteFile handler] 從 JSON input 解析到 content，長度: ${String(content).length}`);
              
              // 確保 content 是字串
              if (typeof content !== 'string') {
                content = String(content);
              }
            } else {
              throw new Error('❌ 無法解析 JSON input');
            }
          }
        } catch (error) {
          // 如果不是 JSON，忽略錯誤，使用原有邏輯
          console.log(`[dockerWriteFile handler] input 不是有效的 JSON，跳過解析`);
        }
      }

      // 3. 最終驗證
      if (!filePath || typeof filePath !== 'string') {
        throw new Error(`❌ 缺少有效的檔案路徑。收到: ${JSON.stringify(filePath)}`);
      }
      
      if (!content || typeof content !== 'string') {
        throw new Error(`❌ 缺少有效的檔案內容。收到類型: ${typeof content}`);
      }

      console.log(`[dockerWriteFile handler] ✅ 參數驗證通過 - 檔案: ${filePath}, 內容長度: ${content.length}`);

      const result = await docker_write_file({
        filePath,
        content
      }, context);

      if (!result.success) {
        return `寫入失敗: ${result.error}`;
      }
      return result.message || '寫入成功。';
    });
  },
  validator: async (parameters: unknown) => {
    console.log(`[dockerWriteFile validator] 收到參數:`, JSON.stringify(parameters, null, 2));
    
    if (!parameters || typeof parameters !== 'object') {
      return {
        isValid: false,
        reason: '缺少必要參數'
      };
    }

    const params = parameters as Record<string, unknown>;
    let filePath: string | undefined;
    let content: string | undefined;

    // 簡化的驗證邏輯
    if (params.filePath && typeof params.filePath === 'string') {
      filePath = params.filePath;
    }
    
    if (params.content && typeof params.content === 'string') {
      content = params.content;
    }

    // 如果標準參數不完整，嘗試從 input 解析
    if ((!filePath || !content) && params.input && typeof params.input === 'string') {
      try {
        const parsed = JSON.parse(params.input);
        if (typeof parsed === 'object' && parsed !== null) {
          if (!filePath && parsed.filePath && typeof parsed.filePath === 'string') {
            filePath = parsed.filePath;
          }
          if (!content && parsed.content && typeof parsed.content === 'string') {
            content = parsed.content;
          }
        }
      } catch (error) {
        // JSON 解析失敗，繼續使用現有的 filePath 和 content
      }
    }

    if (!filePath || typeof filePath !== 'string') {
      return {
        isValid: false,
        reason: `❌ 缺少有效的檔案路徑。請使用 { "filePath": "路徑", "content": "內容" } 格式。`
      };
    }

    if (!content || typeof content !== 'string') {
      return {
        isValid: false,
        reason: `❌ 缺少檔案內容。請使用 { "filePath": "${filePath}", "content": "內容" } 格式。`
      };
    }

    console.log(`[dockerWriteFile validator] ✅ 參數驗證通過`);
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
  handler: async (parameters: Record<string, unknown>, context?: unknown) => {
    return safeToolCall('docker_check_path_exists', parameters, async () => {
      const toolkit = await getRealDockerToolkit(context);
      // A simple check can be trying to read the file or list the directory
      // For simplicity, we can use readFile and check for success.
      // A more robust implementation might be needed.
      const result = await toolkit.fileSystem.readFile(parameters.path as string);
      // If it's a directory, readFile will fail. Let's try listDirectory.
      if (!result.success) {
        const dirResult = await toolkit.fileSystem.listDirectory(parameters.path as string);
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
  handler: async (parameters: Record<string, unknown>, context?: unknown) => {
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
  // dockerTree,      // 新的標準 tree 命令 - 暫時禁用  
  dockerPwd,       // 新的標準 pwd 命令
  dockerWriteFile,
  dockerCheckPathExists,
  dockerGetProjectInfo,
  // dockerListDirectory 已移除，不再支援 input 參數
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
