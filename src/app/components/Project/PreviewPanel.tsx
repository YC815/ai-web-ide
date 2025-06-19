'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// 設備預設配置
const DEVICE_PRESETS = {
  desktop: { width: '100%', height: '100%', label: '桌面', icon: '🖥️' },
  tablet: { width: '768px', height: '1024px', label: '平板', icon: '📱' },
  mobile: { width: '375px', height: '667px', label: '手機', icon: '📱' },
  custom: { width: '400px', height: '600px', label: '自定義', icon: '⚙️' }
};

// 環境模式配置
const ENV_MODES = {
  development: { label: '開發', color: 'bg-blue-500', icon: '🔧' },
  preview: { label: '預覽', color: 'bg-yellow-500', icon: '👁️' },
  production: { label: '生產', color: 'bg-green-500', icon: '🚀' }
};

interface PreviewPanelProps {
  containerId: string;
  projectStatus: 'running' | 'stopped' | 'error';
}

export function PreviewPanel({ containerId, projectStatus }: PreviewPanelProps) {
  // 狀態管理
  const [selectedDevice, setSelectedDevice] = useState<keyof typeof DEVICE_PRESETS>('desktop');
  const [envMode, setEnvMode] = useState<keyof typeof ENV_MODES>('development');
  const [isLoading, setIsLoading] = useState(false);
  const [customSize, setCustomSize] = useState({ width: '400px', height: '600px' });
  const [previewUrl, setPreviewUrl] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [devServerStatus, setDevServerStatus] = useState<'running' | 'stopped' | 'starting' | 'error'>('stopped');
  const [showIframe, setShowIframe] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // 檢查開發服務器狀態並獲取正確的 URL（智能化版本）
  const checkDevServerStatus = useCallback(async () => {
    try {
      const { getSmartDockerStatusManager } = await import('@/lib/docker/smart-status-manager');
      const manager = getSmartDockerStatusManager();
      
      // 使用智能狀態管理器獲取狀態
      const status = await manager.getContainerStatus(containerId);
      
      if (status && status.status === 'running') {
        if (status.serviceUrl && status.serviceStatus === 'accessible') {
          // 使用實際的服務 URL
          setPreviewUrl(status.serviceUrl);
          setDevServerStatus('running');
          setShowIframe(true);
          setErrors([]);
          return;
        }
      }

      // 如果智能管理器沒有返回可用的服務，檢查開發服務器
      const devResponse = await fetch(`/api/docker-dev-server?containerId=${containerId}`);
      const devData = await devResponse.json();
      
      if (devData.success) {
        setDevServerStatus(devData.status);
        if (devData.status === 'running' && devData.port) {
          // 使用狀態管理器中的端口映射信息
          if (status?.portMappings) {
            const mapping = status.portMappings.find(m => m.containerPort === devData.port);
            if (mapping) {
              setPreviewUrl(`http://localhost:${mapping.hostPort}`);
            } else {
              setPreviewUrl(`http://localhost:${devData.port}`);
            }
          } else {
            setPreviewUrl(`http://localhost:${devData.port}`);
          }
          setShowIframe(true);
          setErrors([]);
        } else {
          setShowIframe(false);
        }
      } else {
        setDevServerStatus('stopped');
        setShowIframe(false);
      }
    } catch (error) {
      console.error('檢查開發服務器狀態失敗:', error);
      setDevServerStatus('error');
    }
  }, [containerId]);

  // 自動啟動開發服務器
  const startDevServer = async () => {
    try {
      setIsLoading(true);
      setDevServerStatus('starting');
      setShowLogs(false); // 預設不顯示日誌
      setLogs([]);
      
      // 添加啟動日誌（但不立即顯示）
      const addLog = (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
      };

      addLog('Starting development server...');
      addLog('Detecting project type...');
      
      const response = await fetch('/api/docker-dev-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'auto-detect-and-start', 
          containerId 
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        addLog('✅ Development server started successfully');
        addLog(`Port: ${data.port || 3000}`);
        setDevServerStatus('running');
        
        // 使用智能狀態管理器重新檢查狀態
        try {
          const { getSmartDockerStatusManager } = await import('@/lib/docker/smart-status-manager');
          const manager = getSmartDockerStatusManager();
          
          addLog('Checking container status...');
          
          // 強制刷新狀態
          const status = await manager.getContainerStatus(containerId, true);
          
          if (status?.portMappings) {
            const mapping = status.portMappings.find(m => m.containerPort === (data.port || 3000));
            if (mapping) {
              setPreviewUrl(`http://localhost:${mapping.hostPort}`);
              addLog(`Preview URL: http://localhost:${mapping.hostPort}`);
            } else {
              setPreviewUrl(`http://localhost:${data.port || 3000}`);
              addLog(`Preview URL: http://localhost:${data.port || 3000}`);
            }
          } else {
            setPreviewUrl(`http://localhost:${data.port || 3000}`);
            addLog(`Preview URL: http://localhost:${data.port || 3000}`);
          }
        } catch {
          setPreviewUrl(`http://localhost:${data.port || 3000}`);
          addLog(`Preview URL: http://localhost:${data.port || 3000}`);
        }
        
        addLog('Server ready, loading preview...');
        setShowIframe(true);
        setErrors([]);
        // 成功時不顯示日誌，直接進入預覽模式
        
      } else {
        // 失敗時才顯示日誌，顯示原始錯誤信息
        addLog(`❌ Failed: ${data.error || 'Unknown error'}`);
        if (data.details) {
          addLog(`Details: ${JSON.stringify(data.details, null, 2)}`);
        }
        if (data.logs && Array.isArray(data.logs)) {
          data.logs.forEach((log: string) => addLog(log));
        }
        addLog('Diagnosis:');
        addLog('  - Check if container is running');
        addLog('  - Check if project directory exists');
        addLog('  - Check if package.json is configured correctly');
        setDevServerStatus('error');
        setErrors([data.error || '啟動開發服務器失敗']);
        setShowLogs(true); // 錯誤時顯示日誌
      }
    } catch (error) {
      console.error('啟動開發服務器失敗:', error);
      const addLog = (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
      };
      addLog(`❌ Connection failed: ${error instanceof Error ? error.message : 'Unable to connect to server'}`);
      addLog('Possible causes:');
      addLog('  - Network connection issues');
      addLog('  - API service not started');
      addLog('  - Container service error');
      setDevServerStatus('error');
      setErrors(['無法連接到服務器']);
      setShowLogs(true); // 錯誤時顯示日誌
    } finally {
      setIsLoading(false);
    }
  };

  // 取得當前設備配置
  const getCurrentDevice = () => {
    if (selectedDevice === 'custom') {
      return { ...DEVICE_PRESETS.custom, ...customSize };
    }
    return DEVICE_PRESETS[selectedDevice];
  };

  // 重新整理預覽
  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    // 如果有正在運行的預覽，重新載入 iframe
    if (showIframe && previewUrl) {
      const iframe = document.querySelector('#preview-iframe') as HTMLIFrameElement;
      if (iframe) {
        iframe.src = iframe.src; // 觸發重新載入
      }
    }
    
    // 重新檢查服務器狀態
    await checkDevServerStatus();
    
    setIsRefreshing(false);
  };

  // 環境檢測
  const handleEnvironmentCheck = async () => {
    setIsLoading(true);
    try {
      await checkDevServerStatus();
      
      // 如果服務器沒有運行，嘗試啟動
      if (devServerStatus !== 'running' && projectStatus === 'running') {
        await startDevServer();
      }
    } catch (error) {
      console.error('環境檢測失敗:', error);
      setErrors(['環境檢測失敗']);
    } finally {
      setIsLoading(false);
    }
  };

  // 自動滾動到日誌底部
  useEffect(() => {
    if (logsEndRef.current && showLogs) {
      // 使用 setTimeout 確保 DOM 更新後再滾動
      setTimeout(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [logs, showLogs]);

  // 初始化檢查（只在專案狀態變化時觸發，避免頻繁檢查）
  useEffect(() => {
    if (containerId && projectStatus === 'running') {
      // 使用智能狀態管理器，只在必要時檢查
      checkDevServerStatus();
    }
  }, [containerId, projectStatus]); // 移除 checkDevServerStatus 依賴，避免無限循環

  const currentDevice = getCurrentDevice();

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* 頂部控制列 */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            👁️ 實時預覽
          </h2>
          
          {/* 環境模式指示器 */}
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-white text-sm ${ENV_MODES.development.color}`}>
              {ENV_MODES.development.icon} {ENV_MODES.development.label}
            </span>
          </div>
        </div>

        {/* 控制工具列 */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* 設備選擇器 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">設備:</span>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value as keyof typeof DEVICE_PRESETS)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Object.entries(DEVICE_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>
                  {preset.icon} {preset.label}
                </option>
              ))}
            </select>
          </div>

          {/* 自定義尺寸輸入 */}
          {selectedDevice === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customSize.width}
                onChange={(e) => setCustomSize(prev => ({ ...prev, width: e.target.value }))}
                placeholder="寬度"
                className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
              <span className="text-gray-500">×</span>
              <input
                type="text"
                value={customSize.height}
                onChange={(e) => setCustomSize(prev => ({ ...prev, height: e.target.value }))}
                placeholder="高度"
                className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
          )}

          {/* 控制按鈕 */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3 py-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400
                       text-white rounded text-sm transition-colors
                       disabled:cursor-not-allowed flex items-center gap-1"
            >
              {isRefreshing ? (
                <>
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                  重新整理中
                </>
              ) : (
                <>🔄 重新整理</>
              )}
            </button>
            
            <button
              onClick={handleEnvironmentCheck}
              disabled={isLoading}
              className="px-3 py-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-400
                       text-white rounded text-sm transition-colors
                       disabled:cursor-not-allowed flex items-center gap-1"
            >
              {isLoading ? (
                <>
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                  檢測中
                </>
              ) : (
                <>🔍 環境檢測</>
              )}
            </button>
          </div>
        </div>

        {/* URL 輸入 */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">URL:</span>
          <input
            type="text"
            value={previewUrl}
            onChange={(e) => setPreviewUrl(e.target.value)}
            className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="http://localhost:3000"
          />
        </div>
      </div>

      {/* 錯誤提示區域 */}
      {errors.length > 0 && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-600 dark:text-red-400">❌</span>
            <span className="text-sm font-medium text-red-700 dark:text-red-300">
              發現 {errors.length} 個錯誤
            </span>
            <button
              onClick={() => setErrors([])}
              className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1">
            {errors.map((error, index) => (
              <div key={index} className="text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 p-2 rounded">
                {error}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 預覽區域 */}
      <div className="flex-1 bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div className="w-full h-full flex justify-center items-center">
          {/* 設備框架 */}
          <div 
            className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 
                     rounded-lg shadow-lg overflow-hidden transition-all duration-300"
            style={{
              width: selectedDevice === 'desktop' ? '100%' : currentDevice.width,
              height: selectedDevice === 'desktop' ? '100%' : currentDevice.height,
              maxWidth: '100%',
              maxHeight: '100%',
              margin: selectedDevice === 'desktop' ? '0' : '16px'
            }}
          >
            {/* 設備頂部指示器 (非桌面模式) */}
            {selectedDevice !== 'desktop' && (
              <div className="bg-gray-800 text-white p-2 text-center text-sm">
                {currentDevice.icon} {currentDevice.label} 
                {selectedDevice === 'custom' && ` (${currentDevice.width} × ${currentDevice.height})`}
              </div>
            )}

            {/* 預覽內容 */}
            <div className="w-full h-full">
              {isLoading ? (
                <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p>{devServerStatus === 'starting' ? '正在啟動開發服務器...' : '載入環境檢測中...'}</p>
                  </div>
                </div>
              ) : showIframe && previewUrl ? (
                <iframe
                  id="preview-iframe"
                  src={previewUrl}
                  className="w-full h-full border-0 rounded-lg"
                  title="應用程式預覽"
                  onLoad={() => console.log('預覽載入完成')}
                  onError={() => {
                    console.error('預覽載入失敗');
                    setErrors(prev => [...prev, '預覽載入失敗，請檢查開發服務器']);
                  }}
                  style={{
                    minHeight: selectedDevice === 'desktop' ? 'calc(100vh - 250px)' : 'auto'
                  }}
                />
              ) : projectStatus !== 'running' ? (
                <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <div className="text-center p-8">
                    <div className="text-6xl mb-4">⏸️</div>
                    <h3 className="text-lg font-medium mb-2">容器未運行</h3>
                    <p className="text-sm">
                      請先啟動專案容器才能查看預覽
                    </p>
                    <div className="mt-4 text-xs">
                      容器狀態: {projectStatus}
                    </div>
                  </div>
                </div>
              ) : devServerStatus === 'error' ? (
                <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <div className="text-center p-8">
                    <div className="text-6xl mb-4">❌</div>
                    <h3 className="text-lg font-medium mb-2">服務器錯誤</h3>
                    <p className="text-sm mb-4">
                      開發服務器無法正常運行
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={startDevServer}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors"
                      >
                        重新啟動服務器
                      </button>
                      {logs.length > 0 && !showLogs && (
                        <button
                          onClick={() => setShowLogs(true)}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm transition-colors"
                        >
                          顯示診斷日誌
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <div className="text-center p-8">
                    <div className="text-6xl mb-4">🚀</div>
                    <h3 className="text-lg font-medium mb-2">準備啟動預覽</h3>
                    <p className="text-sm mb-4">
                      開發服務器尚未運行，點擊下方按鈕啟動
                    </p>
                    <button
                      onClick={startDevServer}
                      disabled={isLoading}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 
                               text-white rounded text-sm transition-colors disabled:cursor-not-allowed"
                    >
                      啟動預覽服務器
                    </button>
                    
                    {/* 動態顯示內容 */}
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-left">
                      {showLogs && logs.length > 0 ? (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-red-700 dark:text-red-300">
                              🔍 診斷日誌:
                            </h4>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setLogs([])}
                                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 text-sm"
                              >
                                清除日誌
                              </button>
                              <button
                                onClick={() => setShowLogs(false)}
                                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 text-sm"
                              >
                                隱藏日誌
                              </button>
                            </div>
                          </div>
                          <div className="bg-gray-900 text-red-400 p-3 rounded font-mono text-xs max-h-48 overflow-y-scroll border border-red-500 scrollbar-thin scrollbar-thumb-red-500 scrollbar-track-gray-800">
                            {logs.map((log, index) => (
                              <div key={index} className={`mb-1 whitespace-pre-wrap break-words ${
                                log.includes('❌') ? 'text-red-300' :
                                log.includes('✅') ? 'text-green-300' :
                                log.includes('Diagnosis') || log.includes('Possible') ? 'text-yellow-300' :
                                'text-gray-300'
                              }`}>
                                {log}
                              </div>
                            ))}
                            <div ref={logsEndRef} />
                          </div>
                          <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded text-sm">
                            <div className="flex items-start gap-2">
                              <span className="text-yellow-600 dark:text-yellow-400">💡</span>
                              <div>
                                <strong className="text-yellow-700 dark:text-yellow-300">故障排除建議:</strong>
                                <ul className="mt-1 text-yellow-600 dark:text-yellow-400 text-xs space-y-1">
                                  <li>• 確認 Docker 容器正在運行</li>
                                  <li>• 檢查專案是否包含 package.json</li>
                                  <li>• 驗證網路連接是否正常</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2">
                            🎯 預覽功能特色:
                          </h4>
                          <ul className="text-sm space-y-1 text-blue-600 dark:text-blue-400">
                            <li>• 📱 多設備響應式預覽</li>
                            <li>• 🔄 實時熱重載</li>
                            <li>• ⚙️ 環境模式切換</li>
                            <li>• 🔍 自動錯誤檢測</li>
                          </ul>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 底部狀態列 */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="text-gray-600 dark:text-gray-400">
              服務器: 
              <span className={`ml-1 ${
                devServerStatus === 'running' ? 'text-green-600 dark:text-green-400' :
                devServerStatus === 'starting' ? 'text-yellow-600 dark:text-yellow-400' :
                devServerStatus === 'error' ? 'text-red-600 dark:text-red-400' :
                'text-gray-600 dark:text-gray-400'
              }`}>
                ● {devServerStatus === 'running' ? '運行中' : 
                   devServerStatus === 'starting' ? '啟動中' :
                   devServerStatus === 'error' ? '錯誤' : '已停止'}
              </span>
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              設備: {currentDevice.label}
            </span>
            {previewUrl && (
              <span className="text-gray-600 dark:text-gray-400 text-xs">
                {previewUrl}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <span>容器: {projectStatus}</span>
          </div>
        </div>
      </div>
    </div>
  );
} 