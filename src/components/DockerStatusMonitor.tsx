'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DockerStatusResponse } from '@/app/api/docker-status/route';
import { ContainerInfo as ApiContainerInfo } from '@/app/api/docker-containers/route';

interface ContainerInfo {
  name: string;
  port: number;
  displayName: string;
}

interface DockerStatusMonitorProps {
  containers?: ContainerInfo[];
  refreshInterval?: number; // 毫秒
  autoRefresh?: boolean;
}

export function DockerStatusMonitor({
  containers: propContainers,
  refreshInterval = 30000, // 30秒，減少頻率避免洗版
  autoRefresh = true
}: DockerStatusMonitorProps) {
  const [containers, setContainers] = useState<ContainerInfo[]>(propContainers || []);
  const [statuses, setStatuses] = useState<Map<string, DockerStatusResponse>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [startingContainers, setStartingContainers] = useState<Set<string>>(new Set());
  const [isClient, setIsClient] = useState(false);
  const [isPaused, setIsPaused] = useState(false); // 新增：暫停自動刷新控制

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

  const fetchContainerStatus = useCallback(async (container: ContainerInfo) => {
    try {
      const response = await fetch(
        `/api/docker-status?containerId=${container.name}&port=${container.port}`
      );
      const data: DockerStatusResponse = await response.json();
      return { key: container.name, data };
    } catch (error) {
      return {
        key: container.name,
        data: {
          success: false,
          error: error instanceof Error ? error.message : 'Network error',
          lastChecked: new Date().toISOString()
        } as DockerStatusResponse
      };
    }
  }, []);

  const refreshStatuses = useCallback(async () => {
    setIsLoading(true);
    try {
      // 如果沒有預設容器，先獲取動態容器列表
      let currentContainers = containers;
      if (currentContainers.length === 0) {
        currentContainers = await fetchContainerList();
      }

      if (currentContainers.length === 0) {
        setStatuses(new Map());
        setLastUpdate(new Date());
        return;
      }

      const results = await Promise.all(
        currentContainers.map(container => fetchContainerStatus(container))
      );

      const newStatuses = new Map();
      results.forEach(({ key, data }) => {
        newStatuses.set(key, data);
      });

      setStatuses(newStatuses);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to refresh Docker statuses:', error);
    } finally {
      setIsLoading(false);
    }
  }, [containers, fetchContainerStatus, fetchContainerList]);

  // 初始載入和自動刷新
  useEffect(() => {
    refreshStatuses();

    if (autoRefresh && !isPaused) {
      const interval = setInterval(refreshStatuses, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshStatuses, autoRefresh, refreshInterval, isPaused]);

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
        // 等待幾秒後刷新狀態
        setTimeout(() => {
          refreshStatuses();
        }, 5000);
        
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
  }, [refreshStatuses]);

  const getStatusIcon = (status: DockerStatusResponse) => {
    if (!status.success) {
      return '❌';
    }

    switch (status.containerStatus) {
      case 'running':
        return status.serviceStatus === 'accessible' ? '🟢' : '🟡';
      case 'stopped':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const getStatusText = (status: DockerStatusResponse) => {
    if (!status.success) {
      return `錯誤: ${status.error}`;
    }

    switch (status.containerStatus) {
      case 'running':
        return status.serviceStatus === 'accessible' 
          ? '運行中 & 可訪問' 
          : '運行中但不可訪問';
      case 'stopped':
        return '已停止';
      default:
        return '狀態未知';
    }
  };

  const getStatusColor = (status: DockerStatusResponse) => {
    if (!status.success) {
      return 'text-red-600';
    }

    switch (status.containerStatus) {
      case 'running':
        return status.serviceStatus === 'accessible' 
          ? 'text-green-600' 
          : 'text-yellow-600';
      case 'stopped':
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
            Docker 容器狀態監控
          </h3>
          <div className="text-sm text-gray-500">載入中...</div>
        </div>
        <div className="text-center py-8">
          <div className="text-2xl mb-2">🔄</div>
          <p className="text-gray-600">正在初始化監控系統...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Docker 容器狀態監控
        </h3>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-sm text-gray-500">
              上次更新: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          {autoRefresh && (
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                isPaused 
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {isPaused ? '▶️ 恢復' : '⏸️ 暫停'}
            </button>
          )}
          <button
            onClick={refreshStatuses}
            disabled={isLoading}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? '更新中...' : '🔄 刷新'}
          </button>
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
                  {status && status.containerStatus === 'running' && status.serviceStatus !== 'accessible' && (
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

              {/* 自動刷新指示器 */}
        {autoRefresh && (
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              {isPaused ? (
                <>⏸️ 自動刷新已暫停 - 每 {refreshInterval / 1000} 秒</>
              ) : (
                <>🔄 每 {refreshInterval / 1000} 秒自動刷新</>
              )}
            </p>
          </div>
        )}

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