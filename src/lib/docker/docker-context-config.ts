/**
 * Docker 上下文配置
 * 包含所有可用的 Docker 容器配置信息
 */

import { DockerContext } from './tools';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 動態 Docker 上下文配置
export const DOCKER_CONTEXTS = {
  // 當前容器（新增）
  currentWebTest: {
    containerId: '41acd88ac05a',
    containerName: 'ai-web-ide-web-test-1750130681993',
    workingDirectory: '/app/workspace/web_test',
    status: 'running' as const,
    projectName: 'web_test',
    hasPackageJson: true
  },

  // Web Test 容器
  webTest: {
    containerId: '4bf66b074def',
    containerName: 'ai-web-ide-web-test-1750127042397',
    workingDirectory: '/app/workspace/web_test',
    status: 'running' as const,
    projectName: 'web_test',
    hasPackageJson: true
  },
  
  // Docker Test 容器
  dockerTest: {
    containerId: '26a41a4ea7ec',
    containerName: 'ai-web-ide-docker-test-1750065348808',
    workingDirectory: '/app/workspace/docker_test',
    status: 'running' as const,
    projectName: 'docker_test',
    hasPackageJson: true
  },
  
  // Minecraft Info 容器
  minecraftInfo: {
    containerId: '7df86921d2ab',
    containerName: 'ai-web-ide-minecraft-info-1750064241477',
    workingDirectory: '/app/workspace',
    status: 'running' as const,
    projectName: 'minecraft_info',
    hasPackageJson: false
  },
  
  // Test 容器
  test: {
    containerId: '22f4b689ef71',
    containerName: 'ai-web-ide-test-1750059930101',
    workingDirectory: '/app/workspace/test',
    status: 'running' as const,
    projectName: 'test',
    hasPackageJson: true
  }
} as const;

/**
 * 動態檢測並更新 Docker 容器狀態
 */
export async function refreshDockerContexts(): Promise<void> {
  try {
    console.log('🔄 正在刷新 Docker 容器狀態...');
    
    const { stdout } = await execAsync('docker ps -a --format "{{.ID}}\t{{.Names}}\t{{.Status}}"');
    const containers = stdout.trim().split('\n').map(line => {
      const [id, name, status] = line.split('\t');
      return { id, name, status: status.toLowerCase().includes('up') ? 'running' : 'stopped' };
    });

    // 動態更新容器狀態
    for (const container of containers) {
      const context = Object.values(DOCKER_CONTEXTS).find(ctx => 
        ctx.containerId.startsWith(container.id) || ctx.containerName === container.name
      );
      
      if (context) {
        // @ts-ignore - 動態更新狀態
        context.status = container.status as 'running' | 'stopped';
      }
    }

    console.log('✅ Docker 容器狀態已更新');
  } catch (error) {
    console.warn('⚠️ 無法刷新 Docker 容器狀態:', error);
  }
}

/**
 * 根據容器ID獲取 Docker 上下文（增強版）
 */
export async function getDockerContextById(containerId: string): Promise<DockerContext | null> {
  // 首先從靜態配置中查找
  let context = Object.values(DOCKER_CONTEXTS).find(ctx => 
    ctx.containerId === containerId || ctx.containerId.startsWith(containerId)
  );
  
  if (context) {
    return {
      containerId: context.containerId,
      containerName: context.containerName,
      workingDirectory: context.workingDirectory,
      status: context.status
    };
  }

  // 如果靜態配置中找不到，嘗試動態檢測
  try {
    console.log(`🔍 靜態配置中未找到容器 ${containerId}，嘗試動態檢測...`);
    
    const { stdout } = await execAsync(`docker inspect ${containerId} --format "{{.Id}}\t{{.Name}}\t{{.State.Status}}"`);
    const [fullId, name, status] = stdout.trim().split('\t');
    
    if (fullId && name) {
      console.log(`✅ 動態檢測到容器: ${fullId.substring(0, 12)} (${name})`);
      
      // 從容器名稱推斷專案名稱和工作目錄
      const containerName = name.startsWith('/') ? name.substring(1) : name;
      const projectName = extractProjectNameFromContainer(containerName);
      const workingDirectory = projectName ? `/app/workspace/${projectName}` : '/app/workspace';
      
      console.log(`🔧 動態檢測容器配置:`, {
        containerId: fullId.substring(0, 12),
        containerName,
        projectName,
        workingDirectory
      });
      
      const dynamicContext = {
        containerId: fullId.substring(0, 12),
        containerName: containerName,
        workingDirectory: workingDirectory,
        status: status === 'running' ? 'running' as const : 'stopped' as const
      };

      // 將動態檢測的容器加入配置（記憶體中）
      await addDynamicContainer(dynamicContext, projectName);
      
      return dynamicContext;
    }
  } catch (error) {
    console.warn(`⚠️ 無法動態檢測容器 ${containerId}:`, error);
  }
  
  return null;
}

/**
 * 從容器名稱提取專案名稱（增強版）
 */
function extractProjectNameFromContainer(containerName: string): string | null {
  console.log(`🔍 正在從容器名稱提取專案名稱: ${containerName}`);
  
  // 匹配 ai-web-ide-{project-name}-{timestamp} 格式
  const match = containerName.match(/^ai-web-ide-(.+?)-\d+$/);
  if (match) {
    const rawProjectName = match[1];
    const normalizedName = rawProjectName.replace(/-/g, '_'); // 將短橫線轉換為底線
    console.log(`✅ 成功提取專案名稱: ${rawProjectName} -> ${normalizedName}`);
    return normalizedName;
  }
  
  // 如果無法匹配，嘗試其他常見格式
  if (containerName.includes('web-ide')) {
    const parts = containerName.split('-');
    // 找到 web-ide 後面的部分作為專案名稱
    const webIdeIndex = parts.findIndex(part => part === 'ide');
    if (webIdeIndex !== -1 && webIdeIndex + 1 < parts.length) {
      // 取 ide 後面到數字前的所有部分
      const projectParts = [];
      for (let i = webIdeIndex + 1; i < parts.length; i++) {
        if (/^\d+$/.test(parts[i])) break; // 遇到純數字就停止
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
 * 根據容器名稱獲取 Docker 上下文
 */
export function getDockerContextByName(containerName: string): DockerContext | null {
  const context = Object.values(DOCKER_CONTEXTS).find(ctx => 
    ctx.containerName === containerName || ctx.containerName.includes(containerName)
  );
  
  if (!context) {
    return null;
  }
  
  return {
    containerId: context.containerId,
    containerName: context.containerName,
    workingDirectory: context.workingDirectory,
    status: context.status
  };
}

/**
 * 動態加入容器配置
 */
async function addDynamicContainer(context: DockerContext, projectName?: string): Promise<void> {
  const dynamicKey = `dynamic_${context.containerId}`;
  
  // @ts-ignore - 動態添加配置
  DOCKER_CONTEXTS[dynamicKey] = {
    containerId: context.containerId,
    containerName: context.containerName,
    workingDirectory: context.workingDirectory,
    status: context.status,
    projectName: projectName || context.containerName.replace(/^ai-web-ide-|-\d+$/g, ''),
    hasPackageJson: true // 預設為 true
  };
  
  console.log(`📦 已動態加入容器配置: ${context.containerId} (${context.containerName})`);
}

/**
 * 獲取所有可用的 Docker 上下文
 */
export function getAllDockerContexts(): DockerContext[] {
  return Object.values(DOCKER_CONTEXTS).map(context => ({
    containerId: context.containerId,
    containerName: context.containerName,
    workingDirectory: context.workingDirectory,
    status: context.status
  }));
}

/**
 * 創建預設的 Docker 上下文（優先使用當前容器）
 */
export function createDefaultDockerContext(): DockerContext {
  // 優先使用當前容器
  const defaultContext = DOCKER_CONTEXTS.currentWebTest;
  
  return {
    containerId: defaultContext.containerId,
    containerName: defaultContext.containerName,
    workingDirectory: defaultContext.workingDirectory,
    status: defaultContext.status
  };
}

/**
 * 增強的 Docker 上下文驗證
 */
export async function validateDockerContext(context: DockerContext): Promise<boolean> {
  // 檢查基本字段
  if (!context.containerId || !context.containerName || !context.workingDirectory) {
    return false;
  }
  
  // 檢查容器ID格式（至少12個字符）
  if (context.containerId.length < 12) {
    return false;
  }
  
  // 檢查是否為測試容器ID
  if (context.containerId.includes('-container') || 
      context.containerId.startsWith('test-') || 
      context.containerId.startsWith('dev-')) {
    return false;
  }

  // 實際檢查容器是否存在且運行中
  try {
    const { stdout } = await execAsync(`docker inspect ${context.containerId} --format "{{.State.Status}}"`);
    const status = stdout.trim();
    
    if (status === 'running') {
      return true;
    } else {
      console.warn(`⚠️ 容器 ${context.containerId} 狀態為: ${status}`);
      return false;
    }
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
    
    // 1. 刷新容器狀態
    await refreshDockerContexts();
    
    // 2. 如果指定了問題容器，嘗試修復
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
    
    // 3. 找到最佳可用容器
    const allContexts = getAllDockerContexts();
    for (const context of allContexts) {
      const isValid = await validateDockerContext(context);
      if (isValid) {
        return {
          success: true,
          message: `✅ 已切換到可用容器: ${context.containerId}`,
          suggestedContext: context
        };
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
 * Docker 上下文摘要
 */
export const DOCKER_CONTEXT_SUMMARY = {
  total: Object.keys(DOCKER_CONTEXTS).length,
  running: Object.values(DOCKER_CONTEXTS).filter(ctx => ctx.status === 'running').length,
  withPackageJson: Object.values(DOCKER_CONTEXTS).filter(ctx => ctx.hasPackageJson).length,
  containers: Object.values(DOCKER_CONTEXTS).map(ctx => ({
    name: ctx.projectName,
    id: ctx.containerId.substring(0, 12),
    hasProject: ctx.hasPackageJson
  }))
};

// 啟動時自動刷新容器狀態
refreshDockerContexts().then(() => {
  console.log('🐳 Docker 上下文配置已載入:', DOCKER_CONTEXT_SUMMARY);
});

/**
 * 創建並導出 dockerConfigManager 實例
 */
import { DockerConfigManager } from './config-manager';
export const dockerConfigManager = DockerConfigManager.getInstance(); 