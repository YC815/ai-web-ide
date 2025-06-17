'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ProjectHeaderProps {
  projectId: string;
}

// 模擬專案資料
interface Project {
  id: string;
  name: string;
  description: string;
  containerStatus: 'running' | 'stopped' | 'error';
  containerId: string;
  framework: 'next' | 'react' | 'vue' | 'angular' | 'other';
  lastSaved: Date;
}

export function ProjectHeader({ projectId }: ProjectHeaderProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date>(new Date());

  // 模擬載入專案資料
  useEffect(() => {
    // 這裡會從 API 載入真實的專案資料
    setProject({
      id: projectId,
      name: projectId === '1' ? 'AI Web IDE' : 
             projectId === '2' ? 'E-Commerce App' : 
             'Portfolio Website',
      description: projectId === '1' ? '基於對話式交互的即時開發環境' :
                   projectId === '2' ? 'React + TypeScript 電商應用' :
                   'Vue.js 個人作品集網站',
      containerStatus: 'running',
      containerId: `project-${projectId}-container`,
      framework: projectId === '1' ? 'next' : 
                 projectId === '2' ? 'react' : 
                 'vue',
      lastSaved: new Date()
    });
  }, [projectId]);

  // 取得框架圖示
  const getFrameworkIcon = (framework: Project['framework']) => {
    switch (framework) {
      case 'next': return '⚡';
      case 'react': return '⚛️';
      case 'vue': return '💚';
      case 'angular': return '🅰️';
      default: return '📦';
    }
  };

  // 取得狀態顯示
  const getStatusDisplay = (status: Project['containerStatus']) => {
    switch (status) {
      case 'running':
        return { icon: '🟢', text: '運行中', color: 'text-green-600 dark:text-green-400' };
      case 'stopped':
        return { icon: '🟡', text: '已停止', color: 'text-yellow-600 dark:text-yellow-400' };
      case 'error':
        return { icon: '🔴', text: '錯誤', color: 'text-red-600 dark:text-red-400' };
    }
  };

  // 處理容器操作
  const handleContainerAction = async (action: 'restart' | 'stop' | 'logs') => {
    setIsLoading(true);
    try {
      console.log(`執行容器操作: ${action} for ${project?.containerId}`);
      // 這裡會調用 ContainerControlTool
      await new Promise(resolve => setTimeout(resolve, 1000)); // 模擬 API 延遲
      
      if (action === 'restart' && project) {
        setProject({ ...project, containerStatus: 'running' });
      } else if (action === 'stop' && project) {
        setProject({ ...project, containerStatus: 'stopped' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 處理保存操作
  const handleSave = async () => {
    setIsLoading(true);
    try {
      console.log('保存專案變更');
      // 這裡會調用 GitCheckpointTool.createCheckpoint()
      await new Promise(resolve => setTimeout(resolve, 500));
      setLastSaved(new Date());
    } finally {
      setIsLoading(false);
    }
  };

  if (!project) {
    return (
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex items-center">
          <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          <div className="ml-3 w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
      </header>
    );
  }

  const statusDisplay = getStatusDisplay(project.containerStatus);
  const frameworkIcon = getFrameworkIcon(project.framework);

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* 左側：專案資訊 */}
        <div className="flex items-center space-x-4">
          {/* 返回按鈕 */}
          <Link
            href="/"
            className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 
                     hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <span className="mr-1">←</span>
            返回
          </Link>

          {/* 專案名稱和資訊 */}
          <div className="flex items-center space-x-3">
            <span className="text-xl">{frameworkIcon}</span>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                {project.name}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {project.description}
              </p>
            </div>
          </div>

          {/* 容器狀態 */}
          <div className={`flex items-center space-x-1 ${statusDisplay.color}`}>
            <span>{statusDisplay.icon}</span>
            <span className="text-sm font-medium">{statusDisplay.text}</span>
            <span className="text-xs text-gray-400">({project.containerId})</span>
          </div>
        </div>

        {/* 右側：操作按鈕 */}
        <div className="flex items-center space-x-3">
          {/* 最後保存時間 */}
          <div className="text-sm text-gray-500 dark:text-gray-400">
            最後保存: {lastSaved.toLocaleTimeString('zh-TW')}
          </div>

          {/* 保存按鈕 */}
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 
                     disabled:bg-gray-400 text-white text-sm font-medium rounded transition-colors"
          >
            {isLoading ? (
              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin mr-1"></div>
            ) : (
              <span className="mr-1">💾</span>
            )}
            保存
          </button>

          {/* 容器控制下拉選單 */}
          <div className="relative">
            <button
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 
                       text-sm font-medium rounded text-gray-700 dark:text-gray-200 
                       bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="mr-1">🐳</span>
              容器
              <span className="ml-1">⌄</span>
            </button>
            
            {/* 這裡可以加入下拉選單邏輯 */}
          </div>

          {/* 重新啟動按鈕 */}
          <button
            onClick={() => handleContainerAction('restart')}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 
                     disabled:bg-gray-400 text-white text-sm font-medium rounded transition-colors"
            title="重新啟動容器"
          >
            {isLoading ? (
              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span className="mr-1">🔄</span>
                重啟
              </>
            )}
          </button>

          {/* 設定按鈕 */}
          <button
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 
                     text-sm font-medium rounded text-gray-700 dark:text-gray-200 
                     bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="專案設定"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* AI 連線狀態指示器 */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <span>AI Agent 已連線</span>
          </div>
          <div className="flex items-center space-x-1">
            <span>🔧</span>
            <span>工具就緒 (5/5)</span>
          </div>
          <div className="flex items-center space-x-1">
            <span>📡</span>
            <span>WebSocket 連線正常</span>
          </div>
        </div>

        <div className="text-xs text-gray-400">
          專案 ID: {projectId}
        </div>
      </div>
    </header>
  );
} 