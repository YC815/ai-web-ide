'use client';

import { useState } from 'react';

// 專案資料介面
interface Project {
  id: string;
  name: string;
  description: string;
  lastUpdated: Date;
  containerStatus: 'running' | 'stopped' | 'error';
  containerId?: string;
  framework: 'next' | 'react' | 'vue' | 'angular' | 'other';
  recentTodos: {
    id: string;
    text: string;
    completed: boolean;
  }[];
  stats: {
    totalFiles: number;
    totalTodos: number;
    completedTodos: number;
  };
}

interface ProjectCardProps {
  project: Project;
  onAction: (action: 'start' | 'stop' | 'delete' | 'enter') => void;
}

export function ProjectCard({ project, onAction }: ProjectCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 取得狀態圖示和顏色
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

  // 格式化時間
  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return '剛剛';
    if (diffMins < 60) return `${diffMins} 分鐘前`;
    if (diffHours < 24) return `${diffHours} 小時前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    return date.toLocaleDateString('zh-TW');
  };

  // 處理操作按鈕點擊
  const handleAction = async (action: 'start' | 'stop' | 'delete' | 'enter', event: React.MouseEvent) => {
    event.stopPropagation(); // 防止觸發卡片點擊
    setIsLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500)); // 模擬 API 延遲
      onAction(action);
    } finally {
      setIsLoading(false);
    }
  };

  // 處理卡片點擊進入專案
  const handleCardClick = () => {
    if (!isLoading) {
      onAction('enter');
    }
  };

  const statusDisplay = getStatusDisplay(project.containerStatus);
  const frameworkIcon = getFrameworkIcon(project.framework);
  const progressPercentage = project.stats.totalTodos > 0 
    ? Math.round((project.stats.completedTodos / project.stats.totalTodos) * 100) 
    : 0;

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 
                 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer
                 ${isHovered ? 'transform -translate-y-1' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {/* 卡片標頭 */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* 專案名稱和框架 */}
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-lg">{frameworkIcon}</span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                {project.name}
              </h3>
            </div>
            
            {/* 專案描述 */}
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {project.description}
            </p>
          </div>

          {/* 容器狀態 */}
          <div className={`flex items-center space-x-1 ml-2 ${statusDisplay.color}`}>
            <span>{statusDisplay.icon}</span>
            <span className="text-xs font-medium">{statusDisplay.text}</span>
          </div>
        </div>

        {/* TODO 進度條 */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>TODO 進度</span>
            <span>{project.stats.completedTodos}/{project.stats.totalTodos} ({progressPercentage}%)</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div 
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* 懸停時的 TODO 預覽 */}
      {isHovered && project.recentTodos.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-750 border-b border-gray-100 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            最近 TODO:
          </div>
          <div className="space-y-1">
            {project.recentTodos.slice(0, 3).map((todo) => (
              <div key={todo.id} className="flex items-center space-x-2 text-xs">
                <span className={todo.completed ? '✅' : '⭕'}>
                  {todo.completed ? '✅' : '⭕'}
                </span>
                <span className={`truncate ${
                  todo.completed 
                    ? 'text-gray-500 dark:text-gray-400 line-through' 
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {todo.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 卡片底部：統計和操作 */}
      <div className="p-4">
        {/* 統計資訊 */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
          <div className="flex items-center space-x-3">
            <span>📁 {project.stats.totalFiles} 檔案</span>
            <span>🕒 {formatLastUpdated(project.lastUpdated)}</span>
          </div>
          {project.containerId && (
            <span className="text-xs text-gray-400 truncate max-w-[100px]">
              {project.containerId}
            </span>
          )}
        </div>

        {/* 操作按鈕 */}
        <div className="flex items-center space-x-2">
          {/* 進入專案按鈕 */}
          <button
            onClick={(e) => handleAction('enter', e)}
            disabled={isLoading}
            className="flex-1 inline-flex items-center justify-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-xs font-medium rounded transition-colors"
          >
            {isLoading ? (
              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span className="mr-1">💻</span>
                進入開發
              </>
            )}
          </button>

          {/* 容器控制按鈕 */}
          {project.containerStatus === 'running' ? (
            <button
              onClick={(e) => handleAction('stop', e)}
              disabled={isLoading}
              className="inline-flex items-center px-2 py-1.5 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white text-xs rounded transition-colors"
              title="停止容器"
            >
              ⏸
            </button>
          ) : (
            <button
              onClick={(e) => handleAction('start', e)}
              disabled={isLoading}
              className="inline-flex items-center px-2 py-1.5 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white text-xs rounded transition-colors"
              title="啟動容器"
            >
              ▶️
            </button>
          )}

          {/* 刪除按鈕 */}
          <button
            onClick={(e) => handleAction('delete', e)}
            disabled={isLoading}
            className="inline-flex items-center px-2 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white text-xs rounded transition-colors"
            title="刪除專案"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
} 