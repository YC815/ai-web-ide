'use client';

import { useState } from 'react';

// 訊息類型定義
interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function ChatMessages() {
  // 訊息列表狀態
  const [messages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: '歡迎使用 AI Web IDE！我是您的 AI 編程助手，隨時為您提供幫助。',
      timestamp: new Date()
    }
  ]);

  return (
    <div className="flex flex-col space-y-4 p-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] p-3 rounded-lg ${
              message.type === 'user'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
            }`}
          >
            <div className="text-sm">{message.content}</div>
            <div className="text-xs opacity-70 mt-1">
              {message.timestamp.toLocaleTimeString('zh-TW')}
            </div>
          </div>
        </div>
      ))}
      
      {/* 空狀態提示 */}
      {messages.length === 0 && (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          <div className="text-4xl mb-2">💬</div>
          <div>開始對話吧！</div>
        </div>
      )}

      {/* 正在輸入指示器 */}
      <div className="flex justify-start">
        <div className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-lg">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
} 