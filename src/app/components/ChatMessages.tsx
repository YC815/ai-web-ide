'use client';

import { useState, useEffect } from 'react';

// 訊息類型定義
interface Message {
  id: string;
  type: 'user' | 'ai' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: {
    toolName?: string;
    tokenCost?: number;
  };
}

export function ChatMessages() {
  // 訊息歷史狀態
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'system',
      content: '歡迎使用 AI Web IDE！我是您的 AI 編程助手，可以幫助您：\n\n• 🎯 自然語言驅動編碼\n• 📋 自動生成和管理 TODO 任務\n• 👀 實時預覽您的 Next.js 應用\n• 🔧 自動檢測和修復錯誤\n\n請告訴我您想要建立什麼功能！',
      timestamp: new Date(),
    }
  ]);

  // 格式化時間戳
  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 取得訊息樣式
  const getMessageStyle = (type: Message['type']) => {
    switch (type) {
      case 'user':
        return 'bg-blue-500 text-white ml-auto max-w-[80%]';
      case 'ai':
        return 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 mr-auto max-w-[80%]';
      case 'system':
        return 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800 mx-auto max-w-[90%]';
      case 'tool':
        return 'bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-800 mx-auto max-w-[90%]';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white';
    }
  };

  // 取得訊息圖示
  const getMessageIcon = (type: Message['type']) => {
    switch (type) {
      case 'user':
        return '👤';
      case 'ai':
        return '🤖';
      case 'system':
        return '⚙️';
      case 'tool':
        return '🔧';
      default:
        return '💭';
    }
  };

  return (
    <div className="p-4 space-y-4">
      {messages.map((message) => (
        <div key={message.id} className="flex flex-col">
          {/* 訊息主體 */}
          <div className={`p-3 rounded-lg ${getMessageStyle(message.type)}`}>
            {/* 訊息標頭 */}
            <div className="flex items-center gap-2 mb-2 text-sm opacity-75">
              <span>{getMessageIcon(message.type)}</span>
              <span className="font-medium">
                {message.type === 'user' ? '使用者' :
                 message.type === 'ai' ? 'AI 助手' :
                 message.type === 'system' ? '系統' : 
                 message.type === 'tool' ? `工具: ${message.metadata?.toolName || '未知'}` : '訊息'}
              </span>
              <span className="text-xs">
                {formatTimestamp(message.timestamp)}
              </span>
            </div>
            
            {/* 訊息內容 */}
            <div className="whitespace-pre-wrap leading-relaxed">
              {message.content}
            </div>
            
            {/* Token 成本顯示（如果有的話） */}
            {message.metadata?.tokenCost && (
              <div className="mt-2 text-xs opacity-50">
                Token 成本: {message.metadata.tokenCost}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
} 