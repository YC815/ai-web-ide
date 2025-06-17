'use client';

import { useState } from 'react';

interface ProjectFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string[];
  onStatusFilterChange: (statuses: string[]) => void;
  frameworkFilter: string[];
  onFrameworkFilterChange: (frameworks: string[]) => void;
  onCreateProject: () => void;
}

export function ProjectFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  frameworkFilter,
  onFrameworkFilterChange,
  onCreateProject
}: ProjectFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 狀態選項
  const statusOptions = [
    { value: 'running', label: '運行中', icon: '🟢', color: 'bg-green-100 text-green-800' },
    { value: 'stopped', label: '已停止', icon: '🟡', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'error', label: '錯誤', icon: '🔴', color: 'bg-red-100 text-red-800' }
  ];

  // 框架選項
  const frameworkOptions = [
    { value: 'next', label: 'Next.js', icon: '⚡' },
    { value: 'react', label: 'React', icon: '⚛️' },
    { value: 'vue', label: 'Vue.js', icon: '💚' },
    { value: 'angular', label: 'Angular', icon: '🅰️' },
    { value: 'other', label: '其他', icon: '📦' }
  ];

  // 處理狀態篩選切換
  const toggleStatusFilter = (status: string) => {
    if (statusFilter.includes(status)) {
      onStatusFilterChange(statusFilter.filter(s => s !== status));
    } else {
      onStatusFilterChange([...statusFilter, status]);
    }
  };

  // 處理框架篩選切換
  const toggleFrameworkFilter = (framework: string) => {
    if (frameworkFilter.includes(framework)) {
      onFrameworkFilterChange(frameworkFilter.filter(f => f !== framework));
    } else {
      onFrameworkFilterChange([...frameworkFilter, framework]);
    }
  };

  // 清除所有篩選
  const clearAllFilters = () => {
    onSearchChange('');
    onStatusFilterChange(['running', 'stopped', 'error']);
    onFrameworkFilterChange([]);
  };

  // 計算活躍篩選數量
  const activeFiltersCount = 
    (searchQuery ? 1 : 0) + 
    (statusFilter.length < 3 ? 1 : 0) + 
    (frameworkFilter.length > 0 ? 1 : 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      {/* 主要篩選列 */}
      <div className="flex items-center space-x-4">
        {/* 搜尋框 */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-400">🔍</span>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜尋專案名稱或描述..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     placeholder-gray-500 dark:placeholder-gray-400
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* 快速狀態篩選 */}
        <div className="flex items-center space-x-2">
          {statusOptions.map(option => (
            <button
              key={option.value}
              onClick={() => toggleStatusFilter(option.value)}
              className={`inline-flex items-center px-3 py-2 rounded-full text-xs font-medium transition-colors
                        ${statusFilter.includes(option.value)
                          ? option.color
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
            >
              <span className="mr-1">{option.icon}</span>
              {option.label}
            </button>
          ))}
        </div>

        {/* 展開/收合切換 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 
                     rounded-md text-sm font-medium transition-colors
                     ${activeFiltersCount > 0 
                       ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600'
                       : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                     }`}
        >
          <span className="mr-1">⚙️</span>
          進階篩選
          {activeFiltersCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full">
              {activeFiltersCount}
            </span>
          )}
          <span className={`ml-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            ⌄
          </span>
        </button>

        {/* 新建專案按鈕 */}
        <button
          onClick={onCreateProject}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 
                   text-white text-sm font-medium rounded-md transition-colors"
        >
          <span className="mr-2">➕</span>
          新建專案
        </button>
      </div>

      {/* 展開的進階篩選 */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
          {/* 框架篩選 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              框架類型
            </label>
            <div className="flex flex-wrap gap-2">
              {frameworkOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => toggleFrameworkFilter(option.value)}
                  className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                            ${frameworkFilter.includes(option.value)
                              ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-600'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                >
                  <span className="mr-1">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 篩選操作 */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {activeFiltersCount > 0 && (
                <span>已套用 {activeFiltersCount} 個篩選條件</span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {activeFiltersCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 
                           hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  <span className="mr-1">🗑</span>
                  清除篩選
                </button>
              )}
              
              <button
                onClick={() => setIsExpanded(false)}
                className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 
                         hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                收合
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 篩選結果摘要 */}
      {(searchQuery || statusFilter.length < 3 || frameworkFilter.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">篩選條件:</span>
          
          {searchQuery && (
            <span className="inline-flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900/20 
                           text-blue-800 dark:text-blue-300 text-xs rounded">
              搜尋: &quot;{searchQuery}&quot;
              <button
                onClick={() => onSearchChange('')}
                className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
              >
                ✕
              </button>
            </span>
          )}
          
          {statusFilter.length < 3 && statusFilter.length > 0 && (
            <span className="inline-flex items-center px-2 py-1 bg-green-100 dark:bg-green-900/20 
                           text-green-800 dark:text-green-300 text-xs rounded">
              狀態: {statusFilter.map(s => statusOptions.find(o => o.value === s)?.label).join(', ')}
              <button
                onClick={() => onStatusFilterChange(['running', 'stopped', 'error'])}
                className="ml-1 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
              >
                ✕
              </button>
            </span>
          )}
          
          {frameworkFilter.length > 0 && (
            <span className="inline-flex items-center px-2 py-1 bg-purple-100 dark:bg-purple-900/20 
                           text-purple-800 dark:text-purple-300 text-xs rounded">
              框架: {frameworkFilter.map(f => frameworkOptions.find(o => o.value === f)?.label).join(', ')}
              <button
                onClick={() => onFrameworkFilterChange([])}
                className="ml-1 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200"
              >
                ✕
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
} 