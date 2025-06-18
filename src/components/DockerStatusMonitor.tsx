'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DockerStatusResponse } from '@/app/api/docker-status/route';
import { ContainerInfo as ApiContainerInfo } from '@/app/api/docker-containers/route';
import { 
  getSmartDockerStatusManager, 
  DockerContainerStatus, 
  StatusChangeEvent 
} from '@/lib/docker/smart-status-manager';

interface ContainerInfo {
  name: string;
  port: number;
  displayName: string;
}

interface DockerStatusMonitorProps {
  containers?: ContainerInfo[];
  refreshInterval?: number; // 已棄用，使用智能管理器
  autoRefresh?: boolean; // 已棄用，使用智能管理器
}

export function DockerStatusMonitor({
  containers: propContainers,
  refreshInterval = 30000, // 保留向後兼容，但不再使用
  autoRefresh = true // 保留向後兼容，但不再使用
}: DockerStatusMonitorProps) {
  const [containers, setContainers] = useState<ContainerInfo[]>(propContainers || []);
  const [statuses, setStatuses] = useState<Map<string, DockerContainerStatus>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [startingContainers, setStartingContainers] = useState<Set<string>>(new Set());
  const [isClient, setIsClient] = useState(false);
  const [isMonitoringActive, setIsMonitoringActive] = useState(true);

  // 確保這是客戶端渲染
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 獲取動態容器列表
  const fetchContainerList = useCallback(async () => {
    try {
      const response = await fetch('/api/docker-containers');
      const data = await response.json();
      
      if (data.success && data.containers.length > 0) {
        const containerList = data.containers.map((container: ApiContainerInfo) => ({
          name: container.name,
          port: container.ports[0]?.containerPort || 3000,
          displayName: container.name.includes('web') ? '網頁服務' : 
                      container.name.includes('backend') ? '後端服務' : 
                      container.name.includes('frontend') ? '前端服務' : 
                      `容器 ${container.id}`
        }));
        setContainers(containerList);
        return containerList;
      }
      return [];
    } catch (error) {
      console.error('獲取容器列表失敗:', error);
      return [];
    }
  }, []);

  // 使用智能狀態管理器
  useEffect(() => {
    const manager = getSmartDockerStatusManager();
    
    // 訂閱狀態變化事件
    const unsubscribe = manager.subscribe((event: StatusChangeEvent) => {
      setStatuses(prev => {
        const newStatuses = new Map(prev);
        newStatuses.set(event.containerId, event.newStatus);
        return newStatuses;
      });
      setLastUpdate(new Date());
    });

    // 初始化容器列表和狀態
    const initializeMonitoring = async () => {
      setIsLoading(true);
      
      try {
        // 如果沒有預設容器，先獲取動態容器列表
        let currentContainers = containers;
        if (currentContainers.length === 0) {
          currentContainers = await fetchContainerList();
        }

        if (currentContainers.length > 0) {
          // 獲取所有容器的初始狀態
          const containerIds = currentContainers.map(c => c.name);
          const initialStatuses = await manager.getMultipleContainerStatus(containerIds);
          
          setStatuses(initialStatuses);
          setLastUpdate(new Date());
          
          // 如果監控是活躍的，開始監控所有容器
          if (isMonitoringActive) {
            containerIds.forEach(containerId => {
              manager.startMonitoring(containerId);
            });
          }
        }
      } catch (error) {
        console.error('初始化監控失敗:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeMonitoring();

    return () => {
      unsubscribe();
      // 清理時停止監控
      containers.forEach(container => {
        manager.stopMonitoring(container.name);
      });
    };
  }, [containers, fetchContainerList, isMonitoringActive]);

  // 手動刷新
  const refreshStatuses = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const manager = getSmartDockerStatusManager();
      
      // 如果沒有容器，先獲取列表
      let currentContainers = containers;
      if (currentContainers.length === 0) {
        currentContainers = await fetchContainerList();
      }

      if (currentContainers.length > 0) {
        const containerIds = currentContainers.map(c => c.name);
        const refreshedStatuses = await manager.getMultipleContainerStatus(containerIds, true);
        
        setStatuses(refreshedStatuses);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('刷新狀態失敗:', error);
    } finally {
      setIsLoading(false);
    }
  }, [containers, fetchContainerList]);

  // 切換監控狀態
  const toggleMonitoring = useCallback(() => {
    const manager = getSmartDockerStatusManager();
    
    if (isMonitoringActive) {
      // 停止監控
      containers.forEach(container => {
        manager.stopMonitoring(container.name);
      });
      setIsMonitoringActive(false);
    } else {
      // 開始監控
      containers.forEach(container => {
        manager.startMonitoring(container.name);
      });
      setIsMonitoringActive(true);
    }
  }, [containers, isMonitoringActive]);

  // 自動啟動開發服務器
  const handleAutoStartDevServer = useCallback(async (containerName: string) => {
    setStartingContainers(prev => new Set(prev).add(containerName));
    
    try {
      const response = await fetch('/api/docker-dev-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'auto-detect-and-start',
          containerId: containerName
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // 觸發狀態更新
        const manager = getSmartDockerStatusManager();
        await manager.getContainerStatus(containerName, true);
        
        alert(`✅ 開發服務器啟動成功！\n項目路徑: ${result.projectPath}\nPID: ${result.pid}`);
      } else {
        alert(`❌ 啟動失敗: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ 啟動失敗: ${error instanceof Error ? error.message : '網絡錯誤'}`);
    } finally {
      setStartingContainers(prev => {
        const newSet = new Set(prev);
        newSet.delete(containerName);
        return newSet;
      });
    }
  }, []);

  const getStatusIcon = (status: DockerContainerStatus) => {
    switch (status.status) {
      case 'running':
        return status.serviceStatus === 'accessible' ? '🟢' : '🟡';
      case 'stopped':
        return '🔴';
      case 'error':
        return '❌';
      default:
        return '⚪';
    }
  };

  const getStatusText = (status: DockerContainerStatus) => {
    switch (status.status) {
      case 'running':
        return status.serviceStatus === 'accessible' 
          ? '運行中 & 可訪問' 
          : '運行中但不可訪問';
      case 'stopped':
        return '已停止';
      case 'error':
        return `錯誤: ${status.error}`;
      default:
        return '狀態未知';
    }
  };

  const getStatusColor = (status: DockerContainerStatus) => {
    switch (status.status) {
      case 'running':
        return status.serviceStatus === 'accessible' 
          ? 'text-green-600' 
          : 'text-yellow-600';
      case 'stopped':
        return 'text-red-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  // 防止 hydration mismatch，在客戶端渲染之前顯示簡單內容
  if (!isClient) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            智能 Docker 容器狀態監控
          </h3>
          <div className="text-sm text-gray-500">載入中...</div>
        </div>
        <div className="text-center py-8">
          <div className="text-2xl mb-2">🔄</div>
          <p className="text-gray-600">正在初始化智能監控系統...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          🧠 智能 Docker 容器狀態監控
        </h3>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-sm text-gray-500">
              上次更新: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={toggleMonitoring}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              isMonitoringActive 
                ? 'bg-green-500 hover:bg-green-600 text-white' 
                : 'bg-gray-500 hover:bg-gray-600 text-white'
            }`}
          >
            {isMonitoringActive ? '🟢 智能監控中' : '⚪ 監控已暫停'}
          </button>
          <button
            onClick={refreshStatuses}
            disabled={isLoading}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? '更新中...' : '🔄 刷新'}
          </button>
        </div>
      </div>

      {/* 智能監控說明 */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <span className="text-blue-600">💡</span>
          <div className="text-sm text-blue-800">
            <strong>智能監控特點：</strong>
            <ul className="mt-1 space-y-1 text-xs">
              <li>• 15秒智能快取，避免重複請求</li>
              <li>• 只在狀態真正變化時更新</li>
              <li>• 事件驅動更新，減少不必要的檢查</li>
              <li>• 自動批量處理，最大化效率</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {containers.map((container) => {
          const status = statuses.get(container.name);
          
          return (
            <div key={container.name} className="border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">
                    {status ? getStatusIcon(status) : '⚪'}
                  </span>
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {container.displayName}
                    </h4>
                    <p className="text-sm text-gray-500">
                      容器: {container.name}
                    </p>
                    {status && (
                      <p className="text-xs text-gray-400">
                        上次檢查: {status.lastChecked.toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <p className={`font-medium ${status ? getStatusColor(status) : 'text-gray-500'}`}>
                    {status ? getStatusText(status) : '載入中...'}
                  </p>
                  {status?.serviceUrl && (
                    <a
                      href={status.serviceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-500 hover:text-blue-700 underline"
                    >
                      {status.serviceUrl}
                    </a>
                  )}
                  {/* 自動啟動按鈕 */}
                  {status && status.status === 'running' && status.serviceStatus !== 'accessible' && (
                    <div className="mt-2">
                      <button
                        onClick={() => handleAutoStartDevServer(container.name)}
                        className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors disabled:opacity-50"
                        disabled={isLoading || startingContainers.has(container.name)}
                      >
                        {startingContainers.has(container.name) ? '🔄 啟動中...' : '🚀 自動啟動開發服務器'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 端口映射詳情 */}
              {status?.portMappings && status.portMappings.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-sm text-gray-600 mb-1">端口映射:</p>
                  <div className="flex flex-wrap gap-2">
                    {status.portMappings.map((mapping, idx) => (
                      <span
                        key={idx}
                        className="inline-block px-2 py-1 bg-gray-100 rounded text-xs"
                      >
                        {mapping.containerPort} → {mapping.hostPort} ({mapping.protocol})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 錯誤訊息 */}
              {status?.error && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-sm text-red-600">
                    錯誤: {status.error}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 智能監控狀態指示器 */}
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">
          {isMonitoringActive ? (
            <>🧠 智能監控啟用 - 自動檢測狀態變化</>
          ) : (
            <>⏸️ 智能監控已暫停 - 點擊上方按鈕恢復</>
          )}
        </p>
      </div>

      {/* 無容器提示 */}
      {containers.length === 0 && !isLoading && (
        <div className="mt-4 text-center py-8">
          <div className="text-4xl mb-4">🐳</div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">
            未發現相關容器
          </h4>
          <p className="text-sm text-gray-600">
            請確保 Docker 容器正在運行並包含 "ai-web-ide" 關鍵字
          </p>
        </div>
      )}
    </div>
  );
}

export default DockerStatusMonitor; 