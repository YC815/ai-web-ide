/**
 * 智能 Docker 狀態管理器
 * 使用事件驅動模式和智能快取來減少頻繁的 API 請求
 */

export interface DockerContainerStatus {
  containerId: string;
  containerName: string;
  status: 'running' | 'stopped' | 'error';
  serviceStatus: 'accessible' | 'not_accessible' | 'unknown';
  serviceUrl?: string;
  lastChecked: Date;
  portMappings?: Array<{
    containerPort: number;
    hostPort: number;
    protocol: string;
  }>;
  error?: string;
}

export interface StatusChangeEvent {
  containerId: string;
  oldStatus: DockerContainerStatus | null;
  newStatus: DockerContainerStatus;
  timestamp: Date;
}

export type StatusChangeListener = (event: StatusChangeEvent) => void;

/**
 * 智能 Docker 狀態管理器
 * 
 * 特點：
 * 1. 統一管理所有容器狀態
 * 2. 智能快取，避免重複請求
 * 3. 事件驅動更新，組件只需監聽變化
 * 4. 自動檢測狀態變化，只在必要時更新
 * 5. 支援批量檢查和單個檢查
 */
export class SmartDockerStatusManager {
  private static instance: SmartDockerStatusManager;
  private statusCache = new Map<string, DockerContainerStatus>();
  private listeners = new Set<StatusChangeListener>();
  private activeChecks = new Set<string>(); // 防止重複檢查
  private checkIntervals = new Map<string, NodeJS.Timeout>();
  private globalCheckInterval?: NodeJS.Timeout;
  
  // 配置參數
  private readonly CACHE_DURATION = 15000; // 15秒快取
  private readonly GLOBAL_CHECK_INTERVAL = 60000; // 60秒全域檢查
  private readonly QUICK_CHECK_INTERVAL = 5000; // 5秒快速檢查（狀態變化時）
  private readonly MAX_CONCURRENT_CHECKS = 3; // 最大並發檢查數

  private constructor() {
    this.startGlobalMonitoring();
  }

  static getInstance(): SmartDockerStatusManager {
    if (!SmartDockerStatusManager.instance) {
      SmartDockerStatusManager.instance = new SmartDockerStatusManager();
    }
    return SmartDockerStatusManager.instance;
  }

  /**
   * 訂閱狀態變化事件
   */
  subscribe(listener: StatusChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 獲取容器狀態（智能快取）
   */
  async getContainerStatus(containerId: string, forceRefresh = false): Promise<DockerContainerStatus | null> {
    const cached = this.statusCache.get(containerId);
    
    // 檢查快取是否有效
    if (!forceRefresh && cached && this.isCacheValid(cached)) {
      return cached;
    }

    // 防止重複檢查
    if (this.activeChecks.has(containerId)) {
      // 等待正在進行的檢查完成
      await this.waitForActiveCheck(containerId);
      return this.statusCache.get(containerId) || null;
    }

    return await this.checkContainerStatus(containerId);
  }

  /**
   * 批量獲取多個容器狀態
   */
  async getMultipleContainerStatus(containerIds: string[], forceRefresh = false): Promise<Map<string, DockerContainerStatus>> {
    const results = new Map<string, DockerContainerStatus>();
    
    // 分批處理，避免過多並發請求
    const batches = this.chunkArray(containerIds, this.MAX_CONCURRENT_CHECKS);
    
    for (const batch of batches) {
      const promises = batch.map(async (containerId) => {
        const status = await this.getContainerStatus(containerId, forceRefresh);
        if (status) {
          results.set(containerId, status);
        }
      });
      
      await Promise.all(promises);
    }
    
    return results;
  }

  /**
   * 開始監控特定容器（高頻監控）
   */
  startMonitoring(containerId: string): void {
    // 清除現有的監控
    this.stopMonitoring(containerId);
    
    // 立即檢查一次
    this.checkContainerStatus(containerId);
    
    // 設置定期檢查
    const interval = setInterval(() => {
      this.checkContainerStatus(containerId);
    }, this.QUICK_CHECK_INTERVAL);
    
    this.checkIntervals.set(containerId, interval);
  }

  /**
   * 停止監控特定容器
   */
  stopMonitoring(containerId: string): void {
    const interval = this.checkIntervals.get(containerId);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(containerId);
    }
  }

  /**
   * 停止所有監控
   */
  stopAllMonitoring(): void {
    // 停止所有容器監控
    this.checkIntervals.forEach(interval => clearInterval(interval));
    this.checkIntervals.clear();
    
    // 停止全域監控
    if (this.globalCheckInterval) {
      clearInterval(this.globalCheckInterval);
      this.globalCheckInterval = undefined;
    }
  }

  /**
   * 獲取所有快取的狀態
   */
  getAllCachedStatuses(): Map<string, DockerContainerStatus> {
    return new Map(this.statusCache);
  }

  /**
   * 清除快取
   */
  clearCache(): void {
    this.statusCache.clear();
  }

  /**
   * 檢查單個容器狀態
   */
  private async checkContainerStatus(containerId: string): Promise<DockerContainerStatus | null> {
    if (this.activeChecks.has(containerId)) {
      return null;
    }

    this.activeChecks.add(containerId);
    
    try {
      const response = await fetch(`/api/docker-status?containerId=${containerId}&port=3000`);
      const data = await response.json();
      
      const newStatus: DockerContainerStatus = {
        containerId,
        containerName: data.containerName || containerId,
        status: data.success && data.containerStatus === 'running' ? 'running' : 
                data.containerStatus === 'stopped' ? 'stopped' : 'error',
        serviceStatus: data.serviceStatus || 'unknown',
        serviceUrl: data.serviceUrl,
        lastChecked: new Date(),
        portMappings: data.portMappings,
        error: data.error
      };

      // 檢查是否有狀態變化
      const oldStatus = this.statusCache.get(containerId);
      const hasChanged = this.hasStatusChanged(oldStatus, newStatus);
      
      // 更新快取
      this.statusCache.set(containerId, newStatus);
      
      // 如果狀態有變化，通知監聽者
      if (hasChanged) {
        this.notifyListeners({
          containerId,
          oldStatus,
          newStatus,
          timestamp: new Date()
        });
      }
      
      return newStatus;
      
    } catch (error) {
      const errorStatus: DockerContainerStatus = {
        containerId,
        containerName: containerId,
        status: 'error',
        serviceStatus: 'unknown',
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      const oldStatus = this.statusCache.get(containerId);
      this.statusCache.set(containerId, errorStatus);
      
      if (this.hasStatusChanged(oldStatus, errorStatus)) {
        this.notifyListeners({
          containerId,
          oldStatus,
          newStatus: errorStatus,
          timestamp: new Date()
        });
      }
      
      return errorStatus;
      
    } finally {
      this.activeChecks.delete(containerId);
    }
  }

  /**
   * 開始全域監控
   */
  private startGlobalMonitoring(): void {
    // 每分鐘檢查一次所有已知容器
    this.globalCheckInterval = setInterval(() => {
      this.performGlobalCheck();
    }, this.GLOBAL_CHECK_INTERVAL);
  }

  /**
   * 執行全域檢查
   */
  private async performGlobalCheck(): void {
    // 只檢查快取中的容器，避免不必要的發現
    const containerIds = Array.from(this.statusCache.keys());
    
    if (containerIds.length === 0) {
      return;
    }

    // 批量檢查
    await this.getMultipleContainerStatus(containerIds, true);
  }

  /**
   * 檢查快取是否有效
   */
  private isCacheValid(status: DockerContainerStatus): boolean {
    const now = new Date();
    const cacheAge = now.getTime() - status.lastChecked.getTime();
    return cacheAge < this.CACHE_DURATION;
  }

  /**
   * 檢查狀態是否有變化
   */
  private hasStatusChanged(oldStatus: DockerContainerStatus | null, newStatus: DockerContainerStatus): boolean {
    if (!oldStatus) {
      return true;
    }

    return (
      oldStatus.status !== newStatus.status ||
      oldStatus.serviceStatus !== newStatus.serviceStatus ||
      oldStatus.serviceUrl !== newStatus.serviceUrl ||
      JSON.stringify(oldStatus.portMappings) !== JSON.stringify(newStatus.portMappings)
    );
  }

  /**
   * 通知所有監聽者
   */
  private notifyListeners(event: StatusChangeEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in status change listener:', error);
      }
    });
  }

  /**
   * 等待正在進行的檢查完成
   */
  private async waitForActiveCheck(containerId: string): Promise<void> {
    let attempts = 0;
    const maxAttempts = 50; // 5秒超時
    
    while (this.activeChecks.has(containerId) && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
  }

  /**
   * 將陣列分批
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

/**
 * 獲取智能狀態管理器實例
 */
export const getSmartDockerStatusManager = () => SmartDockerStatusManager.getInstance();

/**
 * React Hook：使用智能 Docker 狀態管理器
 */
export const useSmartDockerStatus = (containerId: string, enableMonitoring = false) => {
  const [status, setStatus] = React.useState<DockerContainerStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  
  React.useEffect(() => {
    const manager = getSmartDockerStatusManager();
    
    // 訂閱狀態變化
    const unsubscribe = manager.subscribe((event) => {
      if (event.containerId === containerId) {
        setStatus(event.newStatus);
      }
    });
    
    // 初始載入
    const loadInitialStatus = async () => {
      setIsLoading(true);
      try {
        const initialStatus = await manager.getContainerStatus(containerId);
        setStatus(initialStatus);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadInitialStatus();
    
    // 如果啟用監控，開始監控
    if (enableMonitoring) {
      manager.startMonitoring(containerId);
    }
    
    return () => {
      unsubscribe();
      if (enableMonitoring) {
        manager.stopMonitoring(containerId);
      }
    };
  }, [containerId, enableMonitoring]);
  
  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const manager = getSmartDockerStatusManager();
      const newStatus = await manager.getContainerStatus(containerId, true);
      setStatus(newStatus);
    } finally {
      setIsLoading(false);
    }
  }, [containerId]);
  
  return { status, isLoading, refresh };
};

// 需要 React 的地方
let React: any;
try {
  React = require('react');
} catch {
  // 如果不在 React 環境中，提供空的實現
  React = {
    useState: () => [null, () => {}],
    useEffect: () => {},
    useCallback: (fn: any) => fn,
  };
} 