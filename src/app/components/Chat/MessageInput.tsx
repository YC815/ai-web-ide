'use client';

import { useState, useRef } from 'react';

interface MessageInputProps {
  onSendMessage?: (message: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSendMessage, disabled = false }: MessageInputProps) {
  // 輸入內容狀態
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 處理訊息發送
  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;

    const messageToSend = message.trim();
    setMessage(''); // 清空輸入框
    setIsLoading(true);

    try {
      // 調整 textarea 高度
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      // 呼叫父組件的處理函數
      if (onSendMessage) {
        await onSendMessage(messageToSend);
      }
    } catch (error) {
      console.error('發送訊息時發生錯誤:', error);
      // 如果發送失敗，可以考慮將訊息恢復到輸入框
      setMessage(messageToSend);
    } finally {
      setIsLoading(false);
    }
  };

  // 處理鍵盤事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // 防止換行
      handleSendMessage();
    }
  };

  // 自動調整 textarea 高度
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    setMessage(textarea.value);
    
    // 重置高度再設定新高度，確保正確計算
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800">
      <div className="flex items-end gap-3">
        {/* 訊息輸入框 */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={disabled || isLoading}
            placeholder="輸入您的指令或問題... (Enter 發送，Shift+Enter 換行)"
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     placeholder-gray-500 dark:placeholder-gray-400
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     disabled:opacity-50 disabled:cursor-not-allowed
                     min-h-[44px] max-h-[120px]"
            rows={1}
          />
          
          {/* 輸入提示 */}
          {message.length > 0 && (
            <div className="absolute bottom-1 right-3 text-xs text-gray-400">
              {message.length} 字元
            </div>
          )}
        </div>

        {/* 發送按鈕 */}
        <button
          onClick={handleSendMessage}
          disabled={disabled || isLoading || !message.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
                   text-white rounded-lg transition-colors duration-200
                   disabled:cursor-not-allowed min-w-[80px] h-[44px]
                   flex items-center justify-center"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>傳送中</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span>發送</span>
              <span className="text-sm">↵</span>
            </div>
          )}
        </button>
      </div>

      {/* 快捷指令提示 */}
      <div className="mt-2 flex flex-wrap gap-2">
        {[
          '建立一個 React 組件',
          '修復當前錯誤',
          '生成 TODO 清單',
          '預覽應用程式'
        ].map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => setMessage(suggestion)}
            disabled={disabled || isLoading}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300
                     rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
} 