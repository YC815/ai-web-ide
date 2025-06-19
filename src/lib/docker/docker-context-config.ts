/**
 * Docker 上下文配置
 * 動態檢測和管理 Docker 容器配置信息
 */

import { DockerContext } from './tools';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 動態容器緩存
const DYNAMIC_CONTAINERS_CACHE = new Map<string, DockerContext & { projectName: string; hasPackageJson: boolean }>();

/**
 * 從 URL 或專案 ID 中提取專案資訊
 */
export function extractProjectFromUrl(url: string): string | null {
  console.log(`🔍 正在從 URL 提取專案資訊: ${url}`);

  // 匹配 /project/{project-id} 格式
  const projectMatch = url.match(/\/project\/([^\/\?]+)/);
  if (projectMatch) {
    const projectId = projectMatch[1];
    console.log(`✅ 從 URL 提取專案 ID: ${projectId}`);
    return projectId;
  }

  // 匹配其他可能的格式
  const pathMatch = url.match(/\/([^\/]+)$/);
  if (pathMatch) {
    const possibleProject = pathMatch[1];
    console.log(`🤔 可能的專案名稱: ${possibleProject}`);
    return possibleProject;
  }

  console.log(`❌ 無法從 URL 提取專案資訊: ${url}`);
  return null;
}

/**
 * 根據專案 ID 動態獲取 Docker 上下文
 */
export async function getDockerContextByProjectId(projectId: string): Promise<DockerContext | null> {
  console.log(`🔍 根據專案 ID 查找 Docker 容器: ${projectId}`);

  // 1. 先檢查緩存
  if (DYNAMIC_CONTAINERS_CACHE.has(projectId)) {
    const cached = DYNAMIC_CONTAINERS_CACHE.get(projectId)!;
    console.log(`⚡ 從緩存獲取容器配置: ${cached.containerId}`);
    return {
      containerId: cached.containerId,
      containerName: cached.containerName,
      workingDirectory: cached.workingDirectory,
      status: cached.status
    };
  }

  // 2. 嘗試直接匹配容器名稱
  try {
    const { stdout } = await execAsync('docker ps -a --format "{{.ID}}\\t{{.Names}}\\t{{.Status}}"');
    const containers = stdout.trim().split('\n').map(line => {
      const [containerId, containerName, status] = line.split('\t');
      return {
        containerId: containerId.substring(0, 12),
        containerName,
        status: status.toLowerCase().includes('up') ? 'running' as const : 'stopped' as const
      };
    });

    // 查找匹配的容器
    const matchingContainer = containers.find(container => 
      container.containerName.includes(projectId) || 
      container.containerId === projectId
    );

    if (matchingContainer) {
      console.log(`✅ 找到匹配的容器: ${matchingContainer.containerId} (${matchingContainer.containerName})`);
      
      // 推斷工作目錄和專案名稱
      const projectName = extractProjectNameFromContainer(matchingContainer.containerName) || projectId;
      const workingDirectory = `/app/workspace/${projectName}`;

      const dockerContext: DockerContext = {
        containerId: matchingContainer.containerId,
        containerName: matchingContainer.containerName,
        workingDirectory,
        status: matchingContainer.status
      };

      // 加入緩存
      DYNAMIC_CONTAINERS_CACHE.set(projectId, {
        ...dockerContext,
        projectName,
        hasPackageJson: true
      });

      return dockerContext;
    }

    console.log(`❌ 未找到匹配的容器: ${projectId}`);
    return null;

  } catch (error) {
    console.error(`❌ 查找容器時發生錯誤:`, error);
    return null;
  }
}

/**
 * 動態檢測並更新 Docker 容器狀態
 */
export async function refreshDockerContexts(): Promise<void> {
  try {
    console.log('🔄 正在刷新 Docker 容器狀態...');

    const { stdout } = await execAsync('docker ps -a --format "{{.ID}}\\t{{.Names}}\\t{{.Status}}"');
    const containers = stdout.trim().split('\n').map(line => {
      const [id, name, status] = line.split('\t');
      return { id, name, status: status.toLowerCase().includes('up') ? 'running' : 'stopped' };
    });

    // 更新緩存中的容器狀態
    for (const [projectId, cachedContext] of DYNAMIC_CONTAINERS_CACHE.entries()) {
      const currentContainer = containers.find(c => 
        c.id.startsWith(cachedContext.containerId) || c.name === cachedContext.containerName
      );
      
      if (currentContainer) {
        cachedContext.status = currentContainer.status as 'running' | 'stopped';
      }
    }

    console.log('✅ Docker 容器狀態已更新');
  } catch (error) {
    console.warn('⚠️ 無法刷新 Docker 容器狀態:', error);
  }
}

/**
 * 根據容器ID獲取 Docker 上下文
 */
export async function getDockerContextById(containerId: string): Promise<DockerContext | null> {
  console.log(`🔍 根據容器 ID 查找: ${containerId}`);

  // 先檢查緩存
  for (const [projectId, cachedContext] of DYNAMIC_CONTAINERS_CACHE.entries()) {
    if (cachedContext.containerId === containerId || cachedContext.containerId.startsWith(containerId)) {
      console.log(`⚡ 從緩存獲取容器: ${containerId}`);
      return {
        containerId: cachedContext.containerId,
        containerName: cachedContext.containerName,
        workingDirectory: cachedContext.workingDirectory,
        status: cachedContext.status
      };
    }
  }

  // 動態檢測
  try {
    const { stdout } = await execAsync(`docker inspect ${containerId} --format "{{.Id}}\\t{{.Name}}\\t{{.State.Status}}"`);
    const [fullId, name, status] = stdout.trim().split('\t');

    if (fullId && name) {
      const containerName = name.startsWith('/') ? name.substring(1) : name;
      const projectName = extractProjectNameFromContainer(containerName);
      const workingDirectory = projectName ? `/app/workspace/${projectName}` : '/app/workspace';

      const dockerContext: DockerContext = {
        containerId: fullId.substring(0, 12),
        containerName: containerName,
        workingDirectory: workingDirectory,
        status: status === 'running' ? 'running' as const : 'stopped' as const
      };

      // 加入緩存
      if (projectName) {
        DYNAMIC_CONTAINERS_CACHE.set(projectName, {
          ...dockerContext,
          projectName,
          hasPackageJson: true
        });
      }

      return dockerContext;
    }
  } catch (error) {
    console.warn(`⚠️ 無法檢測容器 ${containerId}:`, error);
  }

  return null;
}

/**
 * 從容器名稱提取專案名稱
 */
function extractProjectNameFromContainer(containerName: string): string | null {
  console.log(`🔍 正在從容器名稱提取專案名稱: ${containerName}`);

  // 匹配 ai-web-ide-{project-name}-{timestamp} 格式
  const match = containerName.match(/^ai-web-ide-(.+?)-\d+$/);
  if (match) {
    const rawProjectName = match[1];
    const normalizedName = rawProjectName.replace(/-/g, '_');
    console.log(`✅ 成功提取專案名稱: ${rawProjectName} -> ${normalizedName}`);
    return normalizedName;
  }

  // 其他格式匹配
  if (containerName.includes('web-ide')) {
    const parts = containerName.split('-');
    const webIdeIndex = parts.findIndex(part => part === 'ide');
    if (webIdeIndex !== -1 && webIdeIndex + 1 < parts.length) {
      const projectParts = [];
      for (let i = webIdeIndex + 1; i < parts.length; i++) {
        if (/^\d+$/.test(parts[i])) break;
        projectParts.push(parts[i]);
      }
      if (projectParts.length > 0) {
        const normalizedName = projectParts.join('_');
        console.log(`✅ 從複雜格式提取專案名稱: ${projectParts.join('-')} -> ${normalizedName}`);
        return normalizedName;
      }
    }
  }

  console.log(`❌ 無法從容器名稱提取專案名稱: ${containerName}`);
  return null;
}

/**
 * 標準化專案名稱：將短橫線轉換為底線
 */
export function normalizeProjectName(projectName: string): string {
  return projectName.replace(/-/g, '_');
}

/**
 * 根據專案名稱獲取 Docker 上下文（增強版）
 */
export async function getDockerContextByName(projectName: string): Promise<DockerContext | null> {
  console.log(`🔍 根據專案名稱查找 Docker 容器: ${projectName}`);
  
  const normalizedProjectName = normalizeProjectName(projectName);
  
  // 先檢查緩存
  if (DYNAMIC_CONTAINERS_CACHE.has(projectName) || DYNAMIC_CONTAINERS_CACHE.has(normalizedProjectName)) {
    const cached = DYNAMIC_CONTAINERS_CACHE.get(projectName) || DYNAMIC_CONTAINERS_CACHE.get(normalizedProjectName);
    if (cached) {
      console.log(`⚡ 從緩存獲取專案容器: ${cached.containerId}`);
      return {
        containerId: cached.containerId,
        containerName: cached.containerName,
        workingDirectory: cached.workingDirectory,
        status: cached.status
      };
    }
  }

  // 動態檢測
  try {
    const { stdout } = await execAsync('docker ps -a --format "{{.ID}}\\t{{.Names}}\\t{{.Status}}"');
    const lines = stdout.trim().split('\n');
    
    const matchingLine = lines.find(line => {
      const lineLower = line.toLowerCase();
      const projectLower = projectName.toLowerCase();
      const normalizedLower = normalizedProjectName.toLowerCase();
      return lineLower.includes(projectLower) || lineLower.includes(normalizedLower);
    });
    
    if (matchingLine) {
      const [id, name, status] = matchingLine.split('\t');
      const dockerContext: DockerContext = {
        containerId: id.substring(0, 12),
        containerName: name,
        workingDirectory: `/app/workspace/${normalizedProjectName}`,
        status: status.toLowerCase().includes('up') ? 'running' as const : 'stopped' as const,
      };

      // 加入緩存
      DYNAMIC_CONTAINERS_CACHE.set(projectName, {
        ...dockerContext,
        projectName: normalizedProjectName,
        hasPackageJson: true
      });

      console.log(`✅ 動態檢測到專案容器: ${dockerContext.containerId} (${dockerContext.containerName})`);
      return dockerContext;
    }
  } catch (error) {
    console.warn(`⚠️ 動態檢測專案容器時出錯:`, error);
  }

  console.log(`❌ 未找到專案 ${projectName} 的容器`);
  return null;
}

/**
 * 獲取所有可用的 Docker 上下文
 */
export async function getAllDockerContexts(): Promise<DockerContext[]> {
  try {
    const { stdout } = await execAsync('docker ps -a --format "{{.ID}}\\t{{.Names}}\\t{{.Status}}"');
    const containers = stdout.trim().split('\n').map(line => {
      const [containerId, containerName, status] = line.split('\t');
      const projectName = extractProjectNameFromContainer(containerName);
      
      return {
        containerId: containerId.substring(0, 12),
        containerName,
        workingDirectory: projectName ? `/app/workspace/${projectName}` : '/app/workspace',
        status: status.toLowerCase().includes('up') ? 'running' as const : 'stopped' as const
      };
    });

    // 更新緩存
    for (const container of containers) {
      const projectName = extractProjectNameFromContainer(container.containerName);
      if (projectName) {
        DYNAMIC_CONTAINERS_CACHE.set(projectName, {
          ...container,
          projectName,
          hasPackageJson: true
        });
      }
    }

    return containers;
  } catch (error) {
    console.error('❌ 獲取 Docker 容器清單失敗:', error);
    return [];
  }
}

/**
 * 根據當前 URL 動態創建 Docker 上下文
 */
export async function createDockerContextFromUrl(url: string): Promise<DockerContext | null> {
  console.log(`🌐 根據 URL 創建 Docker 上下文: ${url}`);
  
  const projectId = extractProjectFromUrl(url);
  if (!projectId) {
    console.log(`❌ 無法從 URL 提取專案 ID`);
    return null;
  }

  // 嘗試根據專案 ID 獲取容器
  const dockerContext = await getDockerContextByProjectId(projectId);
  if (dockerContext) {
    console.log(`✅ 成功根據 URL 創建 Docker 上下文: ${dockerContext.containerId}`);
    return dockerContext;
  }

  // 如果直接匹配失敗，嘗試使用專案名稱
  const dockerContextByName = await getDockerContextByName(projectId);
  if (dockerContextByName) {
    console.log(`✅ 成功根據專案名稱創建 Docker 上下文: ${dockerContextByName.containerId}`);
    return dockerContextByName;
  }

  console.log(`❌ 無法為 URL ${url} 創建 Docker 上下文`);
  return null;
}

/**
 * 創建預設的 Docker 上下文（動態選擇）
 */
export async function createDefaultDockerContext(): Promise<DockerContext | null> {
  console.log('🔍 創建預設 Docker 上下文（動態選擇）');
  
  try {
    // 獲取所有運行中的容器
    const { stdout } = await execAsync('docker ps --format "{{.ID}}\\t{{.Names}}\\t{{.Status}}"');
    const runningContainers = stdout.trim().split('\n').map(line => {
      const [containerId, containerName, status] = line.split('\t');
      return {
        containerId: containerId.substring(0, 12),
        containerName,
        status: 'running' as const
      };
    });

    if (runningContainers.length === 0) {
      console.log('❌ 沒有運行中的容器');
      return null;
    }

    // 優先選擇 ai-web-ide 相關的容器
    const webIdeContainer = runningContainers.find(c => c.containerName.includes('ai-web-ide'));
    if (webIdeContainer) {
      const projectName = extractProjectNameFromContainer(webIdeContainer.containerName);
      const dockerContext: DockerContext = {
        containerId: webIdeContainer.containerId,
        containerName: webIdeContainer.containerName,
        workingDirectory: projectName ? `/app/workspace/${projectName}` : '/app/workspace',
        status: webIdeContainer.status
      };

      console.log(`✅ 選擇預設容器: ${dockerContext.containerId} (${dockerContext.containerName})`);
      return dockerContext;
    }

    // 如果沒有 ai-web-ide 容器，選擇第一個運行中的容器
    const firstContainer = runningContainers[0];
    const dockerContext: DockerContext = {
      containerId: firstContainer.containerId,
      containerName: firstContainer.containerName,
      workingDirectory: '/app/workspace',
      status: firstContainer.status
    };

    console.log(`✅ 選擇預設容器: ${dockerContext.containerId} (${dockerContext.containerName})`);
    return dockerContext;

  } catch (error) {
    console.error('❌ 創建預設 Docker 上下文失敗:', error);
    return null;
  }
}

/**
 * 驗證 Docker 上下文
 */
export async function validateDockerContext(context: DockerContext): Promise<boolean> {
  if (!context.containerId || !context.containerName || !context.workingDirectory) {
    return false;
  }

  if (context.containerId.length < 12) {
    return false;
  }

  try {
    const { stdout } = await execAsync(`docker inspect ${context.containerId} --format "{{.State.Status}}"`);
    const status = stdout.trim();
    return status === 'running';
  } catch (error) {
    console.warn(`⚠️ 無法檢查容器 ${context.containerId} 狀態:`, error);
    return false;
  }
}

/**
 * 自動診斷和修復 Docker 連接問題
 */
export async function autoFixDockerConnection(problemContainerId?: string): Promise<{
  success: boolean;
  message: string;
  suggestedContext?: DockerContext;
}> {
  try {
    console.log('🔧 開始自動診斷 Docker 連接問題...');

    // 刷新容器狀態
    await refreshDockerContexts();

    // 如果指定了問題容器，嘗試修復
    if (problemContainerId) {
      const context = await getDockerContextById(problemContainerId);
      if (context) {
        const isValid = await validateDockerContext(context);
        if (isValid) {
          return {
            success: true,
            message: `✅ 容器 ${problemContainerId} 連接已修復`,
            suggestedContext: context
          };
        }
      }
    }

    // 尋找最佳可用容器
    const allContexts = await getAllDockerContexts();
    for (const context of allContexts) {
      if (context.status === 'running') {
        const isValid = await validateDockerContext(context);
        if (isValid) {
          return {
            success: true,
            message: `✅ 已切換到可用容器: ${context.containerId}`,
            suggestedContext: context
          };
        }
      }
    }

    return {
      success: false,
      message: '❌ 未找到可用的 Docker 容器'
    };

  } catch (error) {
    return {
      success: false,
      message: `❌ 自動修復失敗: ${error}`
    };
  }
}

/**
 * 清除容器緩存
 */
export function clearDockerContextCache(): void {
  DYNAMIC_CONTAINERS_CACHE.clear();
  console.log('🗑️ 已清除 Docker 容器緩存');
}

/**
 * 獲取緩存統計
 */
export function getDockerContextCacheStats(): {
  totalCached: number;
  runningCached: number;
  projects: string[];
} {
  const cached = Array.from(DYNAMIC_CONTAINERS_CACHE.values());
  return {
    totalCached: cached.length,
    runningCached: cached.filter(c => c.status === 'running').length,
    projects: cached.map(c => c.projectName)
  };
}

// 啟動時初始化
refreshDockerContexts().then(() => {
  const stats = getDockerContextCacheStats();
  console.log('🐳 Docker 動態配置已載入:', stats);
});

/**
 * 導出 dockerConfigManager 實例
 */
import { DockerConfigManager } from './config-manager';
export const dockerConfigManager = DockerConfigManager.getInstance(); 