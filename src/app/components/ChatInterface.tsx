'use client';

import { useState } from 'react';
import { TodoList } from './TodoList';
import { ChatMessages } from './ChatMessages';
import { MessageInput } from './MessageInput';

export function ChatInterface() {
  // 狀態管理：當前顯示的 Tab（聊天或TODO）
  const [activeTab, setActiveTab] = useState<'chat' | 'todo'>('chat');

  return (
    <div className="flex flex-col h-full">
      {/* 標題列與 Tab 切換 */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          AI Web IDE
        </h1>
        
        {/* Tab 導航 */}
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
              activeTab === 'chat'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            💬 聊天
          </button>
          <button
            onClick={() => setActiveTab('todo')}
            className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
              activeTab === 'todo'
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            ✅ TODO 列表
          </button>
        </div>
      </div>

      {/* 主內容區域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'chat' ? (
          <>
            {/* 聊天訊息區域 */}
            <div className="flex-1 overflow-y-auto">
              <ChatMessages />
            </div>
            
            {/* 訊息輸入區域 */}
            <div className="border-t border-gray-200 dark:border-gray-700">
              <MessageInput />
            </div>
          </>
        ) : (
          /* TODO 列表區域 */
          <div className="flex-1 overflow-y-auto">
            <TodoList />
          </div>
        )}
      </div>
    </div>
  );
} 