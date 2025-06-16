'use client';

import { useState, useRef, useEffect } from 'react';

// 聊天訊息介面
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokens?: number;
  cost?: number;
  toolCallsExecuted?: number;
  stats?: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageExecutionTime: number;
    toolUsage: Record<string, number>;
  };
}

// 待處理操作介面
interface PendingAction {
  id: string;
  toolName: string;
  status: string;
  confirmationMessage?: string;
  requiresConfirmation: boolean;
}

// 聊天視窗介面
interface ChatWindow {
  id: string;
  title: string;
  messages: ChatMessage[];
  isActive: boolean;
  createdAt: Date;
  totalTokens: number;
  totalCost: number;
}

// 專案狀態指示器組件
const ProjectStatusIndicator = ({ projectName }: { projectName: string }) => {
  return (
    <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
      <div className="flex items-center space-x-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-sm text-blue-700 dark:text-blue-300">
          🤖 AI 已連接到專案 &quot;{projectName}&quot; - 具備完整專案理解能力
        </span>
      </div>
    </div>
  );
};

// 聊天視窗選擇器
const ChatWindowSelector = ({ 
  windows, 
  activeWindowId, 
  onSelectWindow, 
  onNewWindow, 
  onDeleteWindow 
}: {
  windows: ChatWindow[];
  activeWindowId: string;
  onSelectWindow: (windowId: string) => void;
  onNewWindow: () => void;
  onDeleteWindow: (windowId: string) => void;
}) => {
  return (
    <div className="flex items-center space-x-2 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      {/* 聊天視窗標籤 */}
      <div className="flex-1 flex items-center space-x-1 overflow-x-auto">
        {windows.map((window) => (
          <div
            key={window.id}
            className={`flex items-center space-x-2 px-3 py-1 rounded-md text-sm cursor-pointer transition-colors ${
              window.id === activeWindowId
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
            onClick={() => onSelectWindow(window.id)}
          >
            <span className="truncate max-w-24">{window.title}</span>
            {windows.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteWindow(window.id);
                }}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      
      {/* 新增聊天視窗按鈕 */}
      <button
        onClick={onNewWindow}
        className="flex items-center px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        title="新增聊天視窗"
      >
        <span className="text-lg">+</span>
      </button>
    </div>
  );
};

// 確認對話框組件
const ConfirmationDialog = ({ 
  action, 
  onConfirm, 
  onCancel 
}: {
  action: PendingAction;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="text-2xl">
              {action.toolName === 'run_command' && '🔧'}
              {action.toolName === 'propose_diff' && '📝'}
              {action.toolName === 'ask_user' && '❓'}
              {!['run_command', 'propose_diff', 'ask_user'].includes(action.toolName) && '⚙️'}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                即將執行操作
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {action.toolName === 'run_command' && '執行終端命令'}
                {action.toolName === 'propose_diff' && '修改代碼檔案'}
                {action.toolName === 'ask_user' && '用戶輸入請求'}
                {!['run_command', 'propose_diff', 'ask_user'].includes(action.toolName) && action.toolName}
              </p>
            </div>
          </div>
          
          {action.confirmationMessage && (
            <div className="mb-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border-l-4 border-blue-400">
                <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
                  {action.confirmationMessage}
                </pre>
              </div>
            </div>
          )}
          
          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
            >
              ❌ 不要執行
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors"
            >
              ✅ 確認執行
            </button>
          </div>
          
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
            操作 ID: {action.id.split('_').slice(-1)[0]}
          </div>
        </div>
      </div>
    </div>
  );
};

// 主聊天介面組件
export function ChatInterface({ projectName }: { projectName: string }) {
  const [chatWindows, setChatWindows] = useState<ChatWindow[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string>('');
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTokenSettings, setShowTokenSettings] = useState(false);
  const [apiToken, setApiToken] = useState('');
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [useFunctionCalling, setUseFunctionCalling] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 生成穩定的專案 ID（基於專案名稱）
  const projectId = `ai-web-ide-${projectName.toLowerCase().replace(/\s+/g, '-')}`;
  
  // 從 localStorage 載入 Token
  useEffect(() => {
    const savedToken = localStorage.getItem('ai-web-ide-token');
    if (savedToken) {
      setApiToken(savedToken);
    }
  }, []);
  
  // 保存 Token 到 localStorage
  const saveToken = (token: string) => {
    setApiToken(token);
    localStorage.setItem('ai-web-ide-token', token);
    setShowTokenSettings(false);
  };
  
  // 初始化第一個聊天視窗
  useEffect(() => {
    if (chatWindows.length === 0) {
      const firstWindow: ChatWindow = {
        id: 'chat-1',
        title: '聊天 1',
        messages: [{
          id: 'welcome',
          role: 'assistant',
          content: `🎉 歡迎來到 **${projectName}** 專案！

我是您的 AI 專案助理，現在具備強大的 **Function Calling** 能力：

🔧 **Function Calling 模式** (預設啟用)
• 自動選擇和執行適當的工具
• 讀取、編輯和創建檔案
• 執行安全的終端命令
• 生成精確的代碼修改建議
• 與您確認重要操作

🔍 **專案探索**
• 自動掃描和分析專案結構
• 了解檔案組織和依賴關係
• 提供專案狀態報告

⚙️ **專案管理**  
• 初始化新的 Next.js 專案
• 管理專案依賴和配置
• 監控建置和 Git 狀態

🛠️ **開發協助**
• 創建 React 組件和頁面
• 編輯和管理專案檔案  
• 執行 npm 命令和 Git 操作

📊 **智能建議**
• 基於專案狀態提供建議
• 自動檢測和修復問題
• 最佳實踐指導

✨ **特色功能**
• 智能工具選擇和執行
• 詳細的工具調用統計
• 安全的用戶確認機制
• 可視化的操作回饋

💡 **使用提示**
• 您可以在上方切換 Function Calling 模式
• 重要操作會要求您確認
• 每個回應都會顯示工具使用統計

請告訴我您想要做什麼，我會主動使用工具來協助您！`,
          timestamp: new Date(),
        }],
        isActive: true,
        createdAt: new Date(),
        totalTokens: 0,
        totalCost: 0
      };
      setChatWindows([firstWindow]);
      setActiveWindowId(firstWindow.id);
    }
  }, [projectName, chatWindows.length]);
  
  // 自動滾動到最新訊息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatWindows]);
  
  // 獲取當前活躍的聊天視窗
  const activeWindow = chatWindows.find(w => w.id === activeWindowId);
  
  // 創建新聊天視窗
  const createNewChatWindow = () => {
    const newWindow: ChatWindow = {
      id: `chat-${Date.now()}`,
      title: `聊天 ${chatWindows.length + 1}`,
      messages: [{
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `這是一個新的聊天視窗。我會記住之前對話的上下文，可以繼續協助您開發 **${projectName}** 專案。`,
        timestamp: new Date(),
      }],
      isActive: false,
      createdAt: new Date(),
      totalTokens: 0,
      totalCost: 0
    };
    
    setChatWindows(prev => [...prev, newWindow]);
    setActiveWindowId(newWindow.id);
  };
  
  // 刪除聊天視窗
  const deleteChatWindow = (windowId: string) => {
    if (chatWindows.length <= 1) return; // 至少保留一個視窗
    
    setChatWindows(prev => {
      const filtered = prev.filter(w => w.id !== windowId);
      // 如果刪除的是當前活躍視窗，切換到第一個視窗
      if (windowId === activeWindowId) {
        setActiveWindowId(filtered[0]?.id || '');
      }
      return filtered;
    });
  };
  
  // 發送訊息
  const sendMessage = async () => {
    if (!currentMessage.trim()) return;
    
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: currentMessage,
      timestamp: new Date(),
    };
    
    // 添加用戶訊息
    setChatWindows(prev => prev.map(window => 
      window.id === activeWindowId 
        ? { ...window, messages: [...window.messages, userMessage] }
        : window
    ));
    
    setCurrentMessage('');
    setIsLoading(true);
    
    try {
      // 選擇使用 Function Calling API 或傳統 API
      const apiEndpoint = useFunctionCalling ? '/api/chat-with-tools' : '/api/chat';
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentMessage,
          projectId: projectId,
          projectName: projectName,
          conversationId: activeWindowId,
          apiToken: apiToken,
          useAdvancedTools: true,
          enableUserConfirmation: true,
          // 傳統 API 的參數（向後兼容）
          useFullPrompt: true
        })
      });
      
      const result = await response.json();
      
      console.log('API 回應:', result); // 調試日誌
      
      if (result.success && result.data) {
        console.log('pendingActions:', result.data.pendingActions); // 調試日誌
        
        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: result.data.message,
          timestamp: new Date(),
          tokens: result.data.promptInfo?.promptLength || 0,
          cost: 0,
          toolCallsExecuted: result.data.toolCallsExecuted,
          stats: result.data.stats
        };
        
        // 更新待處理操作
        if (result.data.pendingActions) {
          console.log('設置 pendingActions:', result.data.pendingActions); // 調試日誌
          setPendingActions(result.data.pendingActions);
        }
        
        // 添加 AI 回覆
        setChatWindows(prev => prev.map(window => 
          window.id === activeWindowId 
            ? { 
                ...window, 
                messages: [...window.messages, assistantMessage],
                totalTokens: window.totalTokens + (assistantMessage.tokens || 0),
                totalCost: window.totalCost + (assistantMessage.cost || 0)
              }
            : window
        ));

        // 如果有專案報告或建議，也顯示出來
        if (result.data.projectReport) {
          const reportMessage: ChatMessage = {
            id: `msg-${Date.now()}-report`,
            role: 'assistant',
            content: `📊 **專案報告**\n\n${result.data.projectReport}`,
            timestamp: new Date(),
          };
          
          setChatWindows(prev => prev.map(window => 
            window.id === activeWindowId 
              ? { ...window, messages: [...window.messages, reportMessage] }
              : window
          ));
        }

        if (result.data.suggestions && result.data.suggestions.length > 0) {
          const suggestionsMessage: ChatMessage = {
            id: `msg-${Date.now()}-suggestions`,
            role: 'assistant',
            content: `💡 **智能建議**\n\n${result.data.suggestions.map((s: string) => `• ${s}`).join('\n')}`,
            timestamp: new Date(),
          };
          
          setChatWindows(prev => prev.map(window => 
            window.id === activeWindowId 
              ? { ...window, messages: [...window.messages, suggestionsMessage] }
              : window
          ));
        }
      } else {
        throw new Error(result.error || '發送訊息失敗');
      }
    } catch (error) {
      console.error('發送訊息失敗:', error);
      
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: `❌ 發送訊息失敗：${error instanceof Error ? error.message : '未知錯誤'}`,
        timestamp: new Date(),
      };
      
      setChatWindows(prev => prev.map(window => 
        window.id === activeWindowId 
          ? { ...window, messages: [...window.messages, errorMessage] }
          : window
      ));
    } finally {
      setIsLoading(false);
    }
  };
  
  // 處理 Enter 鍵發送
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  // 處理用戶確認操作
  const handleUserConfirmation = async (actionId: string, confirmed: boolean) => {
    try {
      const response = await fetch('/api/chat-with-tools', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: activeWindowId,
          actionId,
          confirmed,
          projectId: projectId,
          apiToken: apiToken
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 移除已處理的操作
        setPendingActions(prev => prev.filter(action => action.id !== actionId));
        
        // 找到對應的操作
        const action = pendingActions.find(a => a.id === actionId);
        
        // 添加確認結果訊息
        const confirmationMessage: ChatMessage = {
          id: `msg-${Date.now()}-confirmation`,
          role: 'assistant',
          content: confirmed 
            ? `✅ **操作已確認並執行**\n\n🔧 **工具**: ${action?.toolName || '未知'}\n📝 **狀態**: 已提交執行，請稍候查看結果...` 
            : `❌ **操作已取消**\n\n🔧 **工具**: ${action?.toolName || '未知'}\n📝 **狀態**: 用戶取消操作`,
          timestamp: new Date(),
        };
        
        setChatWindows(prev => prev.map(window => 
          window.id === activeWindowId 
            ? { ...window, messages: [...window.messages, confirmationMessage] }
            : window
        ));

        // 如果確認了操作，等待一段時間後檢查執行結果
        if (confirmed) {
          setTimeout(async () => {
            try {
              // 發送一個查詢訊息來獲取執行結果
              const statusResponse = await fetch('/api/chat-with-tools', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  message: `請檢查剛才執行的操作結果 (操作ID: ${actionId})`,
                  projectId: projectId,
                  projectName: projectName,
                  conversationId: activeWindowId,
                  apiToken: apiToken,
                  useAdvancedTools: true,
                  enableUserConfirmation: true,
                })
              });

              const statusResult = await statusResponse.json();
              
              if (statusResult.success && statusResult.data) {
                const resultMessage: ChatMessage = {
                  id: `msg-${Date.now()}-result`,
                  role: 'assistant',
                  content: `📊 **執行結果更新**\n\n${statusResult.data.message}`,
                  timestamp: new Date(),
                };
                
                setChatWindows(prev => prev.map(window => 
                  window.id === activeWindowId 
                    ? { ...window, messages: [...window.messages, resultMessage] }
                    : window
                ));
              }
            } catch (error) {
              console.error('獲取執行結果失敗:', error);
            }
          }, 2000); // 等待 2 秒後檢查結果
        }
      }
    } catch (error) {
      console.error('處理用戶確認失敗:', error);
      
      // 顯示錯誤訊息
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: `❌ **確認處理失敗**: ${error instanceof Error ? error.message : '未知錯誤'}`,
        timestamp: new Date(),
      };
      
      setChatWindows(prev => prev.map(window => 
        window.id === activeWindowId 
          ? { ...window, messages: [...window.messages, errorMessage] }
          : window
      ));
    }
  };
  
  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-800">
      {/* 專案狀態指示器 */}
      <ProjectStatusIndicator projectName={projectName} />
      
      {/* 聊天視窗選擇器 */}
      <ChatWindowSelector
        windows={chatWindows}
        activeWindowId={activeWindowId}
        onSelectWindow={setActiveWindowId}
        onNewWindow={createNewChatWindow}
        onDeleteWindow={deleteChatWindow}
      />
      
      {/* Token 設定和模式切換 */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {apiToken ? '🔑 Token 已設定' : '⚠️ 請設定 API Token'}
            </span>
            
            {/* Function Calling 模式切換 */}
            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={useFunctionCalling}
                  onChange={(e) => setUseFunctionCalling(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700 dark:text-gray-300">
                  🔧 Function Calling {useFunctionCalling ? '(啟用)' : '(停用)'}
                </span>
              </label>
            </div>
          </div>
          
          <button
            onClick={() => setShowTokenSettings(true)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
          >
            {apiToken ? '更改 Token' : '設定 Token'}
          </button>
        </div>
      </div>
      
      {/* 待處理操作提示 - 改為彈出式對話框 */}
      {pendingActions.length > 0 && pendingActions.map((action) => (
        <ConfirmationDialog
          key={action.id}
          action={action}
          onConfirm={() => handleUserConfirmation(action.id, true)}
          onCancel={() => handleUserConfirmation(action.id, false)}
        />
      ))}
      
      {/* 聊天訊息區域 */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-4">
          {activeWindow?.messages.map((message) => (
            <div key={message.id} className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === 'user' 
                    ? 'bg-green-600' 
                    : 'bg-blue-600'
                }`}>
                  <span className="text-white text-sm">
                    {message.role === 'user' ? '👤' : '🤖'}
                  </span>
                </div>
              </div>
              <div className="flex-1">
                <div className={`rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-green-100 dark:bg-green-900/20'
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                    {message.content}
                  </div>
                  
                  {/* 工具調用統計 */}
                  {message.toolCallsExecuted !== undefined && message.toolCallsExecuted > 0 && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-700">
                      <div className="text-xs text-blue-800 dark:text-blue-300 font-medium">
                        🔧 執行了 {message.toolCallsExecuted} 個工具
                      </div>
                      {message.stats && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 space-y-1">
                          <div>成功: {message.stats.successfulCalls} | 失敗: {message.stats.failedCalls}</div>
                          <div>平均執行時間: {message.stats.averageExecutionTime}ms</div>
                          {Object.keys(message.stats.toolUsage).length > 0 && (
                            <div>
                              使用工具: {Object.entries(message.stats.toolUsage)
                                .map(([tool, count]) => `${tool}(${count})`)
                                .join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {message.tokens && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Tokens: {message.tokens} | 成本: ${message.cost?.toFixed(4) || '0.0000'}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {message.timestamp.toLocaleTimeString('zh-TW')}
                  </span>
                </div>
              </div>
            </div>
          ))}
          
          {/* 載入指示器 */}
          {isLoading && (
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm">🤖</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">AI 正在思考...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* 輸入區域 */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="輸入您的需求或問題..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
              rows={3}
              disabled={isLoading}
            />
          </div>
          <div className="flex flex-col space-y-2">
            <button
              onClick={sendMessage}
              disabled={isLoading || !currentMessage.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <span className="mr-2">📤</span>
              發送
            </button>
          </div>
        </div>
        
        {/* 統計資訊 */}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            Token 使用: {activeWindow?.totalTokens || 0} | 
            本視窗成本: ${(activeWindow?.totalCost || 0).toFixed(4)} |
            總視窗: {chatWindows.length}
          </span>
          <span>最後更新: {new Date().toLocaleString('zh-TW')}</span>
        </div>
      </div>
      
      {/* Token 設定模態框 */}
      {showTokenSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              設定 API Token
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  OpenAI API Token
                </label>
                <input
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  您的 Token 將安全地儲存在本地瀏覽器中
                </p>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  💡 <strong>如何獲取 Token：</strong><br/>
                  1. 前往 <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">OpenAI API Keys</a><br/>
                  2. 點擊 &quot;Create new secret key&quot;<br/>
                  3. 複製生成的 Token 並貼上到此處
                </p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-6">
              <button
                onClick={() => {
                  setShowTokenSettings(false);
                  setApiToken(localStorage.getItem('ai-web-ide-token') || '');
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => saveToken(apiToken)}
                disabled={!apiToken.trim()}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 