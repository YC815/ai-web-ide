/**
 * Docker 上下文配置
 * 包含所有可用的 Docker 容器配置信息
 */

import { DockerContext } from './tools';

// 修復後的 Docker 上下文配置
export const DOCKER_CONTEXTS = {
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
 * 根據容器ID獲取 Docker 上下文
 */
export function getDockerContextById(containerId: string): DockerContext | null {
  const context = Object.values(DOCKER_CONTEXTS).find(ctx => 
    ctx.containerId === containerId || ctx.containerId.startsWith(containerId)
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
 * 創建預設的 Docker 上下文（使用最新的容器）
 */
export function createDefaultDockerContext(): DockerContext {
  // 優先使用 webTest 容器，因為它是最新的
  const defaultContext = DOCKER_CONTEXTS.webTest;
  
  return {
    containerId: defaultContext.containerId,
    containerName: defaultContext.containerName,
    workingDirectory: defaultContext.workingDirectory,
    status: defaultContext.status
  };
}

/**
 * 驗證 Docker 上下文是否有效
 */
export function validateDockerContext(context: DockerContext): boolean {
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
  
  return true;
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

console.log('🐳 Docker 上下文配置已載入:', DOCKER_CONTEXT_SUMMARY); 