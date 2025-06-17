'use client';

import { useState, useRef, useEffect } from 'react';

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

export function PreviewPanel() {
  // 狀態管理
  const [selectedDevice, setSelectedDevice] = useState<keyof typeof DEVICE_PRESETS>('desktop');
  const [envMode, setEnvMode] = useState<keyof typeof ENV_MODES>('development');
  const [isLoading, setIsLoading] = useState(false);
  const [customSize, setCustomSize] = useState({ width: '400px', height: '600px' });
  const [previewUrl, setPreviewUrl] = useState('http://localhost:3000');
  const [errors, setErrors] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
    // 模擬重新整理延遲
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  // 環境檢測
  const handleEnvironmentCheck = async () => {
    setIsLoading(true);
    try {
      // 模擬環境檢測
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 模擬一些錯誤
      const mockErrors = [
        'TypeScript 類型錯誤: Property \'id\' is missing in type',
        'ESLint: Missing dependency in useEffect'
      ];
      
      setErrors(mockErrors);
    } catch (error) {
      console.error('環境檢測失敗:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
            <span className={`px-3 py-1 rounded-full text-white text-sm ${ENV_MODES[envMode].color}`}>
              {ENV_MODES[envMode].icon} {ENV_MODES[envMode].label}
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
      <div className="flex-1 p-4 bg-gray-100 dark:bg-gray-800 overflow-auto">
        <div className="flex justify-center items-start min-h-full">
          {/* 設備框架 */}
          <div 
            className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 
                     rounded-lg shadow-lg overflow-hidden transition-all duration-300"
            style={{
              width: selectedDevice === 'desktop' ? '100%' : currentDevice.width,
              height: selectedDevice === 'desktop' ? '100%' : currentDevice.height,
              maxWidth: '100%',
              maxHeight: '100%'
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
            <div className="w-full h-full flex items-center justify-center">
              {isLoading ? (
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p>載入環境檢測中...</p>
                </div>
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 p-8">
                  <div className="text-6xl mb-4">🚧</div>
                  <h3 className="text-lg font-medium mb-2">預覽準備中</h3>
                  <p className="text-sm">
                    這裡將顯示您的 Next.js 應用程式實時預覽
                  </p>
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-left">
                    <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2">
                      🎯 預覽功能特色:
                    </h4>
                    <ul className="text-sm space-y-1 text-blue-600 dark:text-blue-400">
                      <li>• 📱 多設備響應式預覽</li>
                      <li>• 🔄 實時熱重載</li>
                      <li>• ⚙️ 環境模式切換</li>
                      <li>• 🔍 自動錯誤檢測</li>
                    </ul>
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
              狀態: <span className="text-green-600 dark:text-green-400">● 就緒</span>
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              設備: {currentDevice.label}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <span>最後更新: 剛剛</span>
          </div>
        </div>
      </div>
    </div>
  );
} 