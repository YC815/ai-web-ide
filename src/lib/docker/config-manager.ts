import { exec } from 'child_process';
import { promisify } from 'util';
import { DockerContext } from './tools';
import { logger } from '../core/logger';

const execAsync = promisify(exec);

export interface DockerConfigResult {
  success: boolean;
  dockerContext?: DockerContext;
  error?: string;
  message: string;
  availableContainers?: Array<{
    id: string;
    name: string;
    status: string;
    image: string;
  }>;
}

export class DockerConfigManager {
  private static instance: DockerConfigManager;
  private cachedContext: DockerContext | null = null;
  private lastCheck: number = 0;
  private readonly CACHE_DURATION = 30000; // 30秒快取

  static getInstance(): DockerConfigManager {
    if (!DockerConfigManager.instance) {
      DockerConfigManager.instance = new DockerConfigManager();
    }
    return DockerConfigManager.instance;
  }

  /**
   * 自動檢測並配置 Docker 容器
   */
  async autoDetectDockerContext(projectName: string = 'ai-creator'): Promise<DockerConfigResult> {
    try {
      // 檢查快取
      if (this.cachedContext && (Date.now() - this.lastCheck) < this.CACHE_DURATION) {
        return {
          success: true,
          dockerContext: this.cachedContext,
          message: '使用快取的 Docker 配置'
        };
      }

      logger.info('DockerConfig', 'Starting Docker auto-detection', { projectName });

      // 1. 檢查 Docker 是否可用
      const dockerAvailable = await this.checkDockerAvailable();
      if (!dockerAvailable.success) {
        return this.createFallbackConfig(projectName, dockerAvailable.error || 'Docker 不可用');
      }

      // 2. 列出所有運行中的容器
      const containers = await this.listRunningContainers();
      if (!containers.success || !containers.containers || containers.containers.length === 0) {
        return this.createFallbackConfig(projectName, '沒有找到運行中的 Docker 容器');
      }

      // 3. 嘗試找到最適合的容器
      const bestContainer = this.selectBestContainer(containers.containers, projectName);
      if (!bestContainer) {
        return {
          success: false,
          error: '無法找到適合的 Docker 容器',
          message: '請確保有運行中的 Docker 容器',
          availableContainers: containers.containers
        };
      }

      // 4. 驗證容器可用性
      const validation = await this.validateContainer(bestContainer.id);
      if (!validation.success) {
        return this.createFallbackConfig(projectName, `容器驗證失敗: ${validation.error}`);
      }

      // 5. 創建 Docker 上下文
      const dockerContext: DockerContext = {
        containerId: bestContainer.id,
        containerName: bestContainer.name,
        workingDirectory: '/app',
        status: 'running'
      };

      // 更新快取
      this.cachedContext = dockerContext;
      this.lastCheck = Date.now();

      logger.info('DockerConfig', 'Docker context auto-detected successfully', dockerContext);

      return {
        success: true,
        dockerContext,
        message: `成功檢測到 Docker 容器: ${bestContainer.name} (${bestContainer.id.substring(0, 12)})`
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('DockerConfig', 'Docker auto-detection failed', error instanceof Error ? error : new Error(errorMessage));
      
      return this.createFallbackConfig(projectName, `自動檢測失敗: ${errorMessage}`);
    }
  }

  /**
   * 檢查 Docker 是否可用
   */
  private async checkDockerAvailable(): Promise<{ success: boolean; error?: string }> {
    try {
      await execAsync('docker --version');
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Docker command not found' 
      };
    }
  }

  /**
   * 列出運行中的容器
   */
  private async listRunningContainers(): Promise<{
    success: boolean;
    containers?: Array<{ id: string; name: string; status: string; image: string }>;
    error?: string;
  }> {
    try {
      const { stdout } = await execAsync('docker ps --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}"');
      
      const containers = stdout.trim().split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [id, name, status, image] = line.split('|');
          return { id, name, status, image };
        });

      return { success: true, containers };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to list containers' 
      };
    }
  }

  /**
   * 選擇最適合的容器
   */
  private selectBestContainer(
    containers: Array<{ id: string; name: string; status: string; image: string }>,
    projectName: string
  ): { id: string; name: string; status: string; image: string } | null {
    // 優先級排序
    const priorities = [
      // 1. 包含專案名稱的容器
      (c: any) => c.name.toLowerCase().includes(projectName.toLowerCase()),
      // 2. 包含 'app' 或 'web' 的容器
      (c: any) => c.name.toLowerCase().includes('app') || c.name.toLowerCase().includes('web'),
      // 3. Node.js 相關的容器
      (c: any) => c.image.toLowerCase().includes('node') || c.image.toLowerCase().includes('npm'),
      // 4. 開發相關的容器
      (c: any) => c.name.toLowerCase().includes('dev') || c.name.toLowerCase().includes('development'),
      // 5. 任何運行中的容器
      (c: any) => c.status.toLowerCase().includes('up')
    ];

    for (const priority of priorities) {
      const matches = containers.filter(priority);
      if (matches.length > 0) {
        return matches[0]; // 返回第一個匹配的容器
      }
    }

    // 如果沒有匹配的，返回第一個容器
    return containers.length > 0 ? containers[0] : null;
  }

  /**
   * 驗證容器可用性
   */
  private async validateContainer(containerId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 檢查容器狀態
      const { stdout } = await execAsync(`docker inspect ${containerId} --format='{{.State.Status}}'`);
      const status = stdout.trim();

      if (status !== 'running') {
        return { success: false, error: `Container is ${status}, not running` };
      }

      // 嘗試在容器內執行簡單命令
      await execAsync(`docker exec ${containerId} echo "validation test"`);
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Container validation failed' 
      };
    }
  }

  /**
   * 創建後備配置（當 Docker 不可用時）
   */
  private createFallbackConfig(projectName: string, reason: string): DockerConfigResult {
    logger.warn('DockerConfig', 'Creating fallback Docker config', { projectName, reason });

    const fallbackContext: DockerContext = {
      containerId: `fallback-${projectName}-${Date.now()}`,
      containerName: `${projectName}-fallback`,
      workingDirectory: '/app',
      status: 'error'
    };

    return {
      success: false,
      dockerContext: fallbackContext,
      error: reason,
      message: `Docker 不可用，使用後備配置。原因: ${reason}`
    };
  }

  /**
   * 手動設定 Docker 上下文
   */
  setDockerContext(dockerContext: DockerContext): void {
    this.cachedContext = dockerContext;
    this.lastCheck = Date.now();
    logger.info('DockerConfig', 'Docker context manually set', dockerContext);
  }

  /**
   * 清除快取
   */
  clearCache(): void {
    this.cachedContext = null;
    this.lastCheck = 0;
    logger.info('DockerConfig', 'Docker config cache cleared');
  }

  /**
   * 獲取當前配置
   */
  getCurrentContext(): DockerContext | null {
    return this.cachedContext;
  }
}

// 創建全域實例
export const dockerConfigManager = DockerConfigManager.getInstance(); 