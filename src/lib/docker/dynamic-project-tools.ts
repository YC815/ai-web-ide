/**
 * 動態專案名稱管理工具
 * 從不同來源動態獲取專案名稱並配置 Docker 工具
 */

import { DockerContext, DockerToolkit, createDockerToolkit, createDefaultDockerContext } from './tools';
import { extractProjectFromUrl, getDockerContextByName, getDockerContextById } from './docker-context-config';

export interface ProjectInfo {
  projectName: string;
  normalizedName: string;
  containerId: string;
  containerName: string;
  workingDirectory: string;
}

export interface DynamicProjectContext {
  url?: string;          // 從網址提取 /project/[id]
  projectId?: string;    // 直接提供的專案 ID
  projectName?: string;  // 直接提供的專案名稱
  containerId?: string;  // 直接提供的容器 ID
}

/**
 * 動態專案工具管理器
 * 自動從不同來源獲取專案資訊並配置對應的 Docker 工具
 */
export class DynamicProjectToolManager {
  private cachedToolkits = new Map<string, DockerToolkit>();
  private projectCache = new Map<string, ProjectInfo>();

  /**
   * 標準化專案名稱：將短橫線轉換為底線，符合容器內目錄格式
   */
  private normalizeProjectName(projectName: string): string {
    return projectName
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_') // 替換特殊字符為底線
      .replace(/-/g, '_');          // 統一使用底線
  }

  /**
   * 從容器名稱提取專案名稱
   */
  private extractProjectNameFromContainer(containerName: string): string | null {
    // 匹配 ai-web-ide-{project-name}-{timestamp} 格式
    const match = containerName.match(/^ai-web-ide-(.+?)-\d+$/);
    if (match) {
      const rawProjectName = match[1];
      return this.normalizeProjectName(rawProjectName);
    }
    return null;
  }

  /**
   * 從動態上下文中解析專案資訊
   */
  async resolveProjectInfo(context: DynamicProjectContext): Promise<ProjectInfo | null> {
    const cacheKey = JSON.stringify(context);
    
    // 檢查快取
    if (this.projectCache.has(cacheKey)) {
      return this.projectCache.get(cacheKey)!;
    }

    console.log(`🔍 [DynamicProject] 解析專案資訊:`, context);

    let projectName: string | null = null;
    let containerId: string | null = null;
    let dockerContext: DockerContext | null = null;

    try {
      // 1. 從 URL 提取專案名稱
      if (context.url) {
        const projectIdFromUrl = extractProjectFromUrl(context.url);
        if (projectIdFromUrl) {
          projectName = projectIdFromUrl;
          console.log(`✅ 從 URL 提取專案名稱: ${projectName}`);
        }
      }

      // 2. 使用直接提供的專案 ID
      if (!projectName && context.projectId) {
        projectName = context.projectId;
        console.log(`✅ 使用提供的專案 ID: ${projectName}`);
      }

      // 3. 使用直接提供的專案名稱
      if (!projectName && context.projectName) {
        projectName = context.projectName;
        console.log(`✅ 使用提供的專案名稱: ${projectName}`);
      }

      // 4. 嘗試獲取 Docker 上下文
      if (context.containerId) {
        dockerContext = await getDockerContextById(context.containerId);
        containerId = context.containerId;
      } else if (projectName) {
        const normalizedName = this.normalizeProjectName(projectName);
        dockerContext = await getDockerContextByName(normalizedName);
        
        // 如果找到了 Docker 上下文，提取容器 ID
        if (dockerContext) {
          containerId = dockerContext.containerId;
          // 嘗試從容器名稱中提取更準確的專案名稱
          const extractedName = this.extractProjectNameFromContainer(dockerContext.containerName);
          if (extractedName) {
            projectName = extractedName;
          }
        }
      }

      if (!projectName) {
        console.error(`❌ [DynamicProject] 無法解析專案名稱`);
        return null;
      }

      const normalizedName = this.normalizeProjectName(projectName);
      
      // 如果沒有找到現有的 Docker 上下文，創建預設的
      if (!dockerContext) {
        containerId = containerId || `ai-web-ide-${normalizedName}`;
        dockerContext = createDefaultDockerContext(
          containerId,
          `ai-dev-${normalizedName}`,
          normalizedName
        );
        console.log(`🐳 創建預設 Docker 上下文:`, dockerContext);
      }

      const projectInfo: ProjectInfo = {
        projectName,
        normalizedName,
        containerId: dockerContext.containerId,
        containerName: dockerContext.containerName,
        workingDirectory: dockerContext.workingDirectory
      };

      // 快取結果
      this.projectCache.set(cacheKey, projectInfo);
      
      console.log(`✅ [DynamicProject] 解析完成:`, projectInfo);
      return projectInfo;

    } catch (error) {
      console.error(`❌ [DynamicProject] 解析專案資訊失敗:`, error);
      return null;
    }
  }

  /**
   * 獲取或創建專案的 Docker 工具包
   */
  async getProjectToolkit(context: DynamicProjectContext): Promise<DockerToolkit | null> {
    const projectInfo = await this.resolveProjectInfo(context);
    if (!projectInfo) {
      return null;
    }

    const toolkitKey = projectInfo.containerId;
    
    // 檢查快取
    if (this.cachedToolkits.has(toolkitKey)) {
      return this.cachedToolkits.get(toolkitKey)!;
    }

    // 創建 Docker 上下文
    const dockerContext: DockerContext = {
      containerId: projectInfo.containerId,
      containerName: projectInfo.containerName,
      workingDirectory: projectInfo.workingDirectory,
      status: 'running'
    };

    // 創建工具包
    const toolkit = createDockerToolkit(dockerContext, projectInfo.normalizedName);
    
    // 快取工具包
    this.cachedToolkits.set(toolkitKey, toolkit);
    
    console.log(`🔧 [DynamicProject] 創建工具包:`, {
      projectName: projectInfo.projectName,
      containerId: projectInfo.containerId,
      workingDirectory: projectInfo.workingDirectory
    });

    return toolkit;
  }

  /**
   * 清除快取（用於開發或重置）
   */
  clearCache(): void {
    this.cachedToolkits.clear();
    this.projectCache.clear();
    console.log(`🧹 [DynamicProject] 快取已清除`);
  }

  /**
   * 獲取所有快取的專案資訊
   */
  getCachedProjects(): ProjectInfo[] {
    return Array.from(this.projectCache.values());
  }
}

/**
 * 全域單例實例
 */
let globalManager: DynamicProjectToolManager | null = null;

/**
 * 獲取全域動態專案工具管理器
 */
export function getDynamicProjectToolManager(): DynamicProjectToolManager {
  if (!globalManager) {
    globalManager = new DynamicProjectToolManager();
  }
  return globalManager;
}

/**
 * 便捷函數：從不同來源創建 Docker 工具包
 */
export async function createDynamicDockerToolkit(context: DynamicProjectContext): Promise<DockerToolkit | null> {
  const manager = getDynamicProjectToolManager();
  return await manager.getProjectToolkit(context);
}

/**
 * 便捷函數：從網址創建 Docker 工具包
 */
export async function createToolkitFromUrl(url: string): Promise<DockerToolkit | null> {
  return await createDynamicDockerToolkit({ url });
}

/**
 * 便捷函數：從專案 ID 創建 Docker 工具包
 */
export async function createToolkitFromProjectId(projectId: string): Promise<DockerToolkit | null> {
  return await createDynamicDockerToolkit({ projectId });
}

/**
 * 便捷函數：從容器 ID 創建 Docker 工具包
 */
export async function createToolkitFromContainerId(containerId: string): Promise<DockerToolkit | null> {
  return await createDynamicDockerToolkit({ containerId });
} 