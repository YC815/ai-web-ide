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
          🤖 AI 已連接到專案 "{projectName}" - 具備完整專案理解能力
        </span>
      </div>
    </div>
  );
};

// 開發伺服器狀態欄組件
const DevServerStatusBar = ({ projectId }: { projectId: string }) => {
  const [serverStatus, setServerStatus] = useState<{
    isRunning: boolean;
    url?: string;
    pid?: string;
    port?: string;
    lastChecked?: Date;
  }>({ isRunning: false });
  const [isChecking, setIsChecking] = useState(false);

  // 檢查開發伺服器狀態
  const checkServerStatus = async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    try {
      const response = await fetch('/api/docker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'docker_check_dev_server_status',
          containerId: projectId,
          parameters: {}
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setServerStatus({
            isRunning: result.data.isRunning,
            url: result.data.url,
            pid: result.data.pid,
            port: result.data.port,
            lastChecked: new Date()
          });
        }
      }
    } catch (error) {
      console.error('檢查開發伺服器狀態失敗:', error);
    } finally {
      setIsChecking(false);
    }
  };

  // 啟動開發伺服器
  const startDevServer = async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    try {
      const response = await fetch('/api/docker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'docker_start_dev_server',
          containerId: projectId,
          parameters: {}
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setServerStatus({
            isRunning: true,
            url: result.data.url,
            lastChecked: new Date()
          });
        }
      }
    } catch (error) {
      console.error('啟動開發伺服器失敗:', error);
    } finally {
      setIsChecking(false);
    }
  };

  // 組件載入時檢查狀態
  useEffect(() => {
    checkServerStatus();
    // 每30秒檢查一次狀態
    const interval = setInterval(checkServerStatus, 30000);
    return () => clearInterval(interval);
  }, [projectId]);

  if (!serverStatus.isRunning && !isChecking) {
    return (
      <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span className="text-sm text-yellow-700 dark:text-yellow-300">
              🔧 開發伺服器未運行
            </span>
          </div>
          <button
            onClick={startDevServer}
            className="px-3 py-1 text-xs bg-yellow-600 hover:bg-yellow-700 text-white rounded-md transition-colors"
          >
            啟動伺服器
          </button>
        </div>
      </div>
    );
  }

  if (isChecking) {
    return (
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/20 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            🔍 檢查開發伺服器狀態...
          </span>
        </div>
      </div>
    );
  }

  if (serverStatus.isRunning) {
    return (
      <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-700 dark:text-green-300">
              🚀 開發伺服器運行中
              {serverStatus.pid && (
                <span className="text-xs text-green-600 dark:text-green-400 ml-1">
                  (PID: {serverStatus.pid})
                </span>
              )}
            </span>
          </div>
          {serverStatus.url && (
            <div className="flex items-center space-x-2">
              <a
                href={serverStatus.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors inline-flex items-center space-x-1"
              >
                <span>🌐</span>
                <span>開啟預覽</span>
              </a>
              <button
                onClick={checkServerStatus}
                className="px-2 py-1 text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 transition-colors"
                title="重新檢查狀態"
              >
                🔄
              </button>
            </div>
          )}
        </div>
        {serverStatus.url && (
          <div className="mt-1 text-xs text-green-600 dark:text-green-400">
            📍 URL: {serverStatus.url}
          </div>
        )}
      </div>
    );
  }

  return null;
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
  onCancel,
  onTimeout 
}: {
  action: PendingAction;
  onConfirm: () => void;
  onCancel: () => void;
  onTimeout: () => void;
}) => {
  const [timeLeft, setTimeLeft] = useState(300); // 5分鐘 = 300秒
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [onTimeout]);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
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
            <div className="text-right">
              <div className="text-sm text-gray-500 dark:text-gray-400">超時倒數</div>
              <div className={`text-lg font-mono ${timeLeft < 60 ? 'text-red-500' : 'text-blue-600'}`}>
                {formatTime(timeLeft)}
              </div>
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
            操作 ID: {action.id.split('_').slice(-1)[0]} | 5分鐘後自動取消
          </div>
        </div>
      </div>
    </div>
  );
};

// 主聊天介面組件
export function ChatInterface({ 
  projectName, 
  projectId, 
  containerId 
}: { 
  projectName: string;
  projectId?: string;
  containerId?: string;
}) {
  const [chatWindows, setChatWindows] = useState<ChatWindow[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string>('');
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTokenSettings, setShowTokenSettings] = useState(false);
  const [apiToken, setApiToken] = useState('');
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [useFunctionCalling, setUseFunctionCalling] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 新增自動修正模式狀態
  const [autoFixMode, setAutoFixMode] = useState(false);
  const [autoFixRunning, setAutoFixRunning] = useState(false);
  const [autoFixLogs, setAutoFixLogs] = useState<string[]>([]);
  const [currentThinking, setCurrentThinking] = useState('');
  const [autoFixIteration, setAutoFixIteration] = useState(0);
  const [maxAutoFixIterations] = useState(10); // 最大迭代次數防止無限循環
  
  // 新增 Agent 控制框架模式
  const [useAgentFramework, setUseAgentFramework] = useState(true); // 預設啟用 Agent 框架
  const [agentStats, setAgentStats] = useState<any>(null);
  
  // 生成唯一ID，避免hydration錯誤
  const generateId = (prefix: string) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}-${timestamp}-${random}`;
  };
  
  // 從 localStorage 載入 Token
  useEffect(() => {
    const savedToken = localStorage.getItem('ai-web-ide-token');
    if (savedToken) {
      setApiToken(savedToken);
    }
    
    // 設置當前時間，避免 hydration 錯誤
    setLastUpdateTime(new Date().toLocaleString('zh-TW'));
  }, []);
  
  // 創建初始聊天視窗
  useEffect(() => {
    if (chatWindows.length === 0) {
      createNewChatWindow();
    }
  }, [chatWindows.length]);
  
  // 保存 Token 到 localStorage
  const saveToken = (token: string) => {
    setApiToken(token);
    localStorage.setItem('ai-web-ide-token', token);
    setShowTokenSettings(false);
  };
  
  // 自動滾動到最新訊息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatWindows]);
  
  // 獲取當前活躍的聊天視窗
  const activeWindow = chatWindows.find(w => w.id === activeWindowId);
  
  // 創建新聊天視窗
  const createNewChatWindow = () => {
    const newWindow: ChatWindow = {
      id: generateId('chat'),
      title: `聊天 ${chatWindows.length + 1}`,
      messages: [{
        id: generateId('welcome'),
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
    if (!currentMessage.trim() || isLoading) return;
    
    if (!apiToken) {
      alert('請先設定 API Token');
      return;
    }

    const userMessage = currentMessage;
    setCurrentMessage('');
    setIsLoading(true);

    // 添加用戶訊息到聊天視窗
    const newUserMessage: ChatMessage = {
      id: generateId('msg-user'),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };

    setChatWindows(prev => prev.map(window => 
      window.id === activeWindowId 
        ? { ...window, messages: [...window.messages, newUserMessage] }
        : window
    ));

    try {
      // 根據配置決定使用哪個 API
      let apiEndpoint: string;
      let requestBody: any;

      if (useAgentFramework) {
        // 使用新的 Agent 控制框架
        apiEndpoint = '/api/chat-agent';
        requestBody = {
          message: userMessage,
          projectId: projectId || `ai-web-ide-${projectName.toLowerCase().replace(/\s+/g, '-')}`,
          projectName,
          containerId: containerId,
          conversationId: activeWindowId,
          apiToken,
          enableAutoRepair: autoFixMode,
          enableLogging: true,
          maxToolCalls: 8,
          timeoutMs: 45000,
        };
      } else {
        // 預設使用新的 Langchain API
        apiEndpoint = '/api/chat';
        requestBody = {
          message: userMessage,
          projectId: projectId || `ai-web-ide-${projectName.toLowerCase().replace(/\s+/g, '-')}`,
          projectName,
          conversationId: activeWindowId,
          apiToken,
          autoRepairMode: autoFixMode,
          useLangchain: true, // 啟用 Langchain 引擎
        };
      }
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        // 嘗試讀取錯誤詳情
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorDetails = errorData.error || errorData.message || '';
        } catch {
          // 如果無法解析 JSON，使用狀態文字
          errorDetails = response.statusText || '';
        }
        
        // 根據狀態碼提供具體的錯誤訊息
        let userFriendlyMessage = '';
        switch (response.status) {
          case 400:
            userFriendlyMessage = '請求參數錯誤，請檢查輸入內容';
            break;
          case 401:
            userFriendlyMessage = 'API Token 無效或已過期，請重新設定';
            break;
          case 403:
            userFriendlyMessage = '沒有權限執行此操作';
            break;
          case 429:
            userFriendlyMessage = 'API 請求頻率過高，請稍後再試';
            break;
          case 500:
            userFriendlyMessage = '伺服器內部錯誤';
            if (errorDetails.includes('OpenAI')) {
              userFriendlyMessage += ' - OpenAI API 問題';
            } else if (errorDetails.includes('Docker')) {
              userFriendlyMessage += ' - Docker 服務問題';
            }
            break;
          case 502:
          case 503:
          case 504:
            userFriendlyMessage = '服務暫時不可用，請稍後重試';
            break;
          default:
            userFriendlyMessage = `未知錯誤 (${response.status})`;
        }
        
        // 組合完整的錯誤訊息
        const fullErrorMessage = errorDetails 
          ? `${userFriendlyMessage}: ${errorDetails}`
          : userFriendlyMessage;
          
        throw new Error(fullErrorMessage);
      }

      const result = await response.json();
      
      if (result.success) {
        // 處理待處理的操作（僅在非 Agent 框架模式下）
        if (!useAgentFramework && result.data.pendingActions && result.data.pendingActions.length > 0) {
          setPendingActions(result.data.pendingActions);
        }

        // 更新 Agent 統計資訊（僅在 Agent 框架模式下）
        if (useAgentFramework && result.data.agentStats) {
          setAgentStats(result.data.agentStats);
        }

        // 添加 AI 回應到聊天視窗
        const aiMessage: ChatMessage = {
          id: generateId('msg-ai'),
          role: 'assistant',
          content: result.data.response || result.data.message,
          timestamp: new Date(),
          tokens: result.data.tokens,
          cost: result.data.cost,
          toolCallsExecuted: result.data.toolCallsExecuted,
          stats: result.data.stats || result.data.agentStats
        };

        setChatWindows(prev => prev.map(window => 
          window.id === activeWindowId 
            ? { 
                ...window, 
                messages: [...window.messages, aiMessage],
                totalTokens: window.totalTokens + (result.data.tokens || 0),
                totalCost: window.totalCost + (result.data.cost || 0)
              }
            : window
        ));

        // 如果是自動修正模式，顯示修正狀態
        if (autoFixMode && result.data.autoRepairResult) {
          const repairResult = result.data.autoRepairResult;
          console.log('🔧 自動修正結果:', repairResult);
          
          // 如果還在進行中，設置自動修正狀態
          if (repairResult.completionStatus === 'in_progress') {
            setAutoFixRunning(true);
          } else {
            setAutoFixRunning(false);
          }
        }

        setLastUpdateTime(new Date().toLocaleTimeString('zh-TW'));
      } else {
        throw new Error(result.error || '未知錯誤');
      }
    } catch (error) {
      console.error('發送訊息失敗:', error);
      
      const errorMessage: ChatMessage = {
        id: generateId('msg-error'),
        role: 'assistant',
        content: `❌ **發送失敗**: ${error instanceof Error ? error.message : '未知錯誤'}`,
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
        
        // 只在確認時添加簡潔的狀態訊息
        if (confirmed) {
          const confirmationMessage: ChatMessage = {
            id: generateId('msg-confirmation'),
            role: 'assistant',
            content: `✅ **操作已確認並執行**\n\n🔧 **工具**: ${action?.toolName || '未知'}\n📝 **狀態**: 已提交執行，請稍候查看結果...`,
            timestamp: new Date(),
          };
          
          setChatWindows(prev => prev.map(window => 
            window.id === activeWindowId 
              ? { ...window, messages: [...window.messages, confirmationMessage] }
              : window
          ));

          // 等待執行結果，但不再發送額外的查詢請求
          setTimeout(async () => {
            try {
              // 只是更新狀態，不發送新的API請求
              const resultMessage: ChatMessage = {
                id: generateId('msg-result'),
                role: 'assistant',
                content: `📊 **執行結果更新**\n\n對不起，我無法獲取到剛才操作的結果。可能是因為操作尚未完成或者出現了一些問題。我建議我們再次嘗試執行 \`tree .\` 命令。`,
                timestamp: new Date(),
              };
              
              setChatWindows(prev => prev.map(window => 
                window.id === activeWindowId 
                  ? { ...window, messages: [...window.messages, resultMessage] }
                  : window
              ));
            } catch (error) {
              console.error('更新執行狀態失敗:', error);
            }
          }, 2000);
        } else {
          // 取消操作時只添加簡單的取消訊息
          const cancelMessage: ChatMessage = {
            id: generateId('msg-cancel'),
            role: 'assistant',
            content: `❌ **操作已取消** - ${action?.toolName || '未知工具'}`,
            timestamp: new Date(),
          };
          
          setChatWindows(prev => prev.map(window => 
            window.id === activeWindowId 
              ? { ...window, messages: [...window.messages, cancelMessage] }
              : window
          ));
        }
      }
    } catch (error) {
      console.error('處理用戶確認失敗:', error);
      
      // 顯示錯誤訊息
      const errorMessage: ChatMessage = {
        id: generateId('msg-error'),
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
  
  const stopAutoFix = () => {
    setAutoFixRunning(false);
    setAutoFixIteration(0);
    setCurrentThinking('');
    console.log('🛑 自動修正已停止');
  };
  
  // 診斷系統問題
  const runDiagnostics = async () => {
    const diagnostics = {
      apiToken: !!apiToken && apiToken.startsWith('sk-'),
      projectId: !!projectId,
      serverHealth: false,
      dockerStatus: false,
    };

    try {
      // 檢查伺服器健康狀態
      const healthResponse = await fetch('/api/health');
      diagnostics.serverHealth = healthResponse.ok;

      // 檢查 Docker 狀態（如果伺服器正常）
      if (diagnostics.serverHealth) {
        try {
          const dockerResponse = await fetch('/api/docker-status');
          diagnostics.dockerStatus = dockerResponse.ok;
        } catch {
          diagnostics.dockerStatus = false;
        }
      }
    } catch {
      diagnostics.serverHealth = false;
    }

    // 生成診斷報告
    const issues = [];
    if (!diagnostics.apiToken) {
      issues.push('❌ API Token 未設定或格式錯誤（應以 sk- 開頭）');
    }
    if (!diagnostics.projectId) {
      issues.push('❌ 專案 ID 未設定');
    }
    if (!diagnostics.serverHealth) {
      issues.push('❌ 伺服器連線失敗');
    }
    if (!diagnostics.dockerStatus) {
      issues.push('⚠️ Docker 服務可能未運行（部分功能受限）');
    }

    const diagnosticMessage: ChatMessage = {
      id: generateId('msg-diagnostic'),
      role: 'assistant',
      content: `🔍 **系統診斷報告**\n\n${
        issues.length === 0 
          ? '✅ 所有系統檢查均正常' 
          : `發現 ${issues.length} 個問題：\n\n${issues.join('\n')}\n\n**建議解決方案：**\n• 請檢查 API Token 設定\n• 確認 Docker 服務是否運行\n• 重新載入頁面再試`
      }`,
      timestamp: new Date(),
    };

    setChatWindows(prev => prev.map(window => 
      window.id === activeWindowId 
        ? { ...window, messages: [...window.messages, diagnosticMessage] }
        : window
    ));
  };
  
  return (
    <div className="flex flex-col bg-white dark:bg-gray-800 h-full">
      {/* 專案狀態指示器 */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <ProjectStatusIndicator projectName={projectName} />
        <DevServerStatusBar projectId={containerId || projectId || `ai-web-ide-${projectName.toLowerCase().replace(/\s+/g, '-')}`} />
      </div>
      
      {/* 聊天視窗選擇器 */}
      <div className="flex-shrink-0">
        <ChatWindowSelector
          windows={chatWindows}
          activeWindowId={activeWindowId}
          onSelectWindow={setActiveWindowId}
          onNewWindow={createNewChatWindow}
          onDeleteWindow={deleteChatWindow}
        />
      </div>
      
      {/* Token 設定和模式切換 */}
      <div className="flex-shrink-0 px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
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

            {/* 自動修正模式切換 */}
            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoFixMode}
                  onChange={(e) => setAutoFixMode(e.target.checked)}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-gray-700 dark:text-gray-300">
                  🔄 自動修正模式 {autoFixMode ? '(啟用)' : '(停用)'}
                </span>
              </label>
            </div>

            {/* 自動修正狀態顯示 */}
            {autoFixRunning && (
              <div className="flex items-center space-x-2 px-2 py-1 bg-green-100 dark:bg-green-900/20 rounded">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600"></div>
                <span className="text-xs text-green-700 dark:text-green-300">
                  第 {autoFixIteration} 次迭代
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {/* 停止自動修正按鈕 */}
            {autoFixRunning && (
              <button
                onClick={stopAutoFix}
                className="px-3 py-1 text-sm text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                🛑 停止自動修正
              </button>
            )}
            
            <button
              onClick={() => setShowTokenSettings(true)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
            >
              {apiToken ? '更改 Token' : '設定 Token'}
            </button>
          </div>
        </div>

        {/* 自動修正思考過程顯示 */}
        {autoFixRunning && currentThinking && (
          <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-700">
            <div className="text-xs text-blue-800 dark:text-blue-300 font-medium">
              🤔 AI 思考過程：
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {currentThinking}
            </div>
          </div>
        )}
      </div>
      
      {/* 待處理操作提示 - 改為彈出式對話框 */}
      {pendingActions.length > 0 && pendingActions.map((action) => (
        <ConfirmationDialog
          key={action.id}
          action={action}
          onConfirm={() => handleUserConfirmation(action.id, true)}
          onCancel={() => handleUserConfirmation(action.id, false)}
          onTimeout={() => handleUserConfirmation(action.id, false)}
        />
      ))}
      
      {/* 聊天訊息區域 */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* 自動修正日誌顯示 */}
          {autoFixMode && autoFixLogs.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                  🔄 自動修正日誌
                </h4>
                <button
                  onClick={() => setAutoFixLogs([])}
                  className="text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
                >
                  清除日誌
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto">
                {autoFixLogs.map((log, index) => (
                  <div key={index} className="text-xs text-yellow-700 dark:text-yellow-300 font-mono mb-1">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

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
          {(isLoading || autoFixRunning) && (
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
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {autoFixRunning ? `自動修正中... (第 ${autoFixIteration} 次迭代)` : 'AI 正在思考...'}
                    </span>
                  </div>
                  {autoFixRunning && currentThinking && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {currentThinking}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* 輸入區域 */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={autoFixMode ? "輸入需求，AI將自動實作並修正錯誤..." : "輸入您的需求或問題..."}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
              rows={3}
              disabled={isLoading || autoFixRunning}
            />
            {autoFixMode && (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                💡 自動修正模式已啟用：AI會自動實作功能並修正所有錯誤，直到完成
              </div>
            )}
          </div>
          <div className="flex flex-col space-y-2">
            <button
              onClick={sendMessage}
              disabled={isLoading || !currentMessage.trim() || autoFixRunning}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <span className="mr-2">📤</span>
              {autoFixRunning ? '自動修正中...' : (autoFixMode ? '開始自動實作' : '發送')}
            </button>
            <button
              onClick={runDiagnostics}
              disabled={isLoading || autoFixRunning}
              className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
              title="檢查系統狀態和常見問題"
            >
              <span className="mr-1">🔍</span>
              診斷
            </button>
          </div>
        </div>
        
        {/* 統計資訊 */}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            Token 使用: {activeWindow?.totalTokens || 0} | 
            本視窗成本: ${(activeWindow?.totalCost || 0).toFixed(4)} |
            總視窗: {chatWindows.length}
            {autoFixMode && ` | 自動修正: ${autoFixRunning ? '運行中' : '待命'}`}
          </span>
          <span>最後更新: {lastUpdateTime}</span>
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