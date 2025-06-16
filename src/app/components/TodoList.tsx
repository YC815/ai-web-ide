'use client';

import { useState, useEffect } from 'react';

// TODO 項目介面定義
interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
  completedAt?: Date;
  category?: 'coding' | 'testing' | 'deployment' | 'documentation' | 'other';
  priority?: 'low' | 'medium' | 'high';
}

export function TodoList() {
  // TODO 列表狀態
  const [todos, setTodos] = useState<TodoItem[]>([
    {
      id: '1',
      text: '初始化 Next.js 專案架構',
      completed: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30分鐘前
      completedAt: new Date(Date.now() - 1000 * 60 * 25), // 25分鐘前
      category: 'coding',
      priority: 'high'
    },
    {
      id: '2',
      text: '建立聊天介面組件 (ChatInterface)',
      completed: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 25),
      completedAt: new Date(Date.now() - 1000 * 60 * 20),
      category: 'coding',
      priority: 'high'
    },
    {
      id: '3',
      text: '實作 TODO 列表管理功能',
      completed: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 20),
      category: 'coding',
      priority: 'high'
    },
    {
      id: '4',
      text: '建立預覽面板與設備模擬器',
      completed: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 15),
      category: 'coding',
      priority: 'medium'
    },
    {
      id: '5',
      text: '整合 AI 工具呼叫介面',
      completed: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 10),
      category: 'coding',
      priority: 'high'
    }
  ]);

  // 篩選狀態
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // 格式化時間
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return '剛剛';
    if (minutes < 60) return `${minutes} 分鐘前`;
    if (hours < 24) return `${hours} 小時前`;
    return `${days} 天前`;
  };

  // 取得類別圖示
  const getCategoryIcon = (category: TodoItem['category']) => {
    switch (category) {
      case 'coding': return '💻';
      case 'testing': return '🧪';
      case 'deployment': return '🚀';
      case 'documentation': return '📝';
      default: return '📋';
    }
  };

  // 取得優先級顏色
  const getPriorityColor = (priority: TodoItem['priority']) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  // 篩選 TODO 項目
  const filteredTodos = todos.filter(todo => {
    const statusMatch = filter === 'all' || 
                       (filter === 'pending' && !todo.completed) ||
                       (filter === 'completed' && todo.completed);
    const categoryMatch = categoryFilter === 'all' || todo.category === categoryFilter;
    return statusMatch && categoryMatch;
  });

  // 統計資訊
  const stats = {
    total: todos.length,
    completed: todos.filter(t => t.completed).length,
    pending: todos.filter(t => !t.completed).length,
    progress: todos.length > 0 ? Math.round((todos.filter(t => t.completed).length / todos.length) * 100) : 0
  };

  return (
    <div className="p-4 h-full flex flex-col">
      {/* 標題與統計 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            📋 TODO 任務列表
          </h2>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {stats.completed}/{stats.total} 完成 ({stats.progress}%)
          </div>
        </div>
        
        {/* 進度條 */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
          <div 
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${stats.progress}%` }}
          ></div>
        </div>
      </div>

      {/* 篩選器 */}
      <div className="mb-4 space-y-3">
        {/* 狀態篩選 */}
        <div className="flex gap-2">
          {[
            { key: 'all', label: '全部', count: stats.total },
            { key: 'pending', label: '待處理', count: stats.pending },
            { key: 'completed', label: '已完成', count: stats.completed }
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key as any)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                filter === item.key
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>

        {/* 類別篩選 */}
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all', label: '所有類別' },
            { key: 'coding', label: '編程' },
            { key: 'testing', label: '測試' },
            { key: 'deployment', label: '部署' },
            { key: 'documentation', label: '文檔' }
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setCategoryFilter(item.key)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                categoryFilter === item.key
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* TODO 列表 */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filteredTodos.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <div className="text-4xl mb-2">📝</div>
            <p>暫無符合條件的任務</p>
          </div>
        ) : (
          filteredTodos.map((todo) => (
            <div
              key={todo.id}
              className={`p-3 rounded-lg border transition-all ${
                todo.completed
                  ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800 opacity-75'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* 完成狀態圖示 */}
                <div className="mt-1">
                  {todo.completed ? (
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  ) : (
                    <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded-full"></div>
                  )}
                </div>

                {/* 任務內容 */}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <p className={`text-sm font-medium ${
                      todo.completed 
                        ? 'text-gray-500 dark:text-gray-400 line-through' 
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {todo.text}
                    </p>
                  </div>

                  {/* 標籤與時間 */}
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    {/* 類別標籤 */}
                    <span className="flex items-center gap-1">
                      {getCategoryIcon(todo.category)}
                      <span className="text-gray-500 dark:text-gray-400">
                        {todo.category || 'other'}
                      </span>
                    </span>

                    {/* 優先級標籤 */}
                    {todo.priority && (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${getPriorityColor(todo.priority)}`}>
                        {todo.priority === 'high' ? '高優先級' : 
                         todo.priority === 'medium' ? '中優先級' : '低優先級'}
                      </span>
                    )}

                    {/* 時間資訊 */}
                    <span className="text-gray-400 dark:text-gray-500 ml-auto">
                      {todo.completed && todo.completedAt
                        ? `完成於 ${formatTime(todo.completedAt)}`
                        : `建立於 ${formatTime(todo.createdAt)}`
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 底部說明 */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          💡 <strong>AI 自動管理：</strong>這些任務由 AI 根據對話內容自動生成和更新。
          當功能完成時，AI 會自動標記為已完成。
        </p>
      </div>
    </div>
  );
} 