'use client';

import { useState, useEffect, useRef } from 'react';

interface LogEntry {
  timestamp: string;
  level: string;
  category: string;
  message: string;
  data?: any;
  error?: string;
}

interface LogStats {
  totalLogs: number;
  levelStats: Record<string, number>;
  categoryStats: Record<string, number>;
  availableFiles: string[];
  logFilePath: string;
  lastUpdate: string;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [filters, setFilters] = useState({
    level: 'all',
    category: 'all',
    lines: 100
  });
  const [autoScroll, setAutoScroll] = useState(true);
  
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // 獲取最近日誌
  const fetchRecentLogs = async () => {
    try {
      const params = new URLSearchParams({
        action: 'recent',
        lines: filters.lines.toString(),
        level: filters.level,
        category: filters.category
      });
      
      const response = await fetch(`/api/admin/logs?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setLogs(result.data.logs);
      }
    } catch (error) {
      console.error('獲取日誌失敗:', error);
    }
  };

  // 獲取統計資訊
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/logs?action=stats');
      const result = await response.json();
      
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('獲取統計資訊失敗:', error);
    }
  };

  // 開始日誌串流
  const startLogStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource('/api/admin/logs?action=stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsStreaming(true);
      console.log('日誌串流已連接');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'log') {
          setLogs(prevLogs => {
            const newLogs = [...prevLogs, data];
            // 保持最多 500 條日誌
            return newLogs.slice(-500);
          });
        }
      } catch (error) {
        console.error('解析日誌串流數據失敗:', error);
      }
    };

    eventSource.onerror = () => {
      setIsStreaming(false);
      console.error('日誌串流連接錯誤');
    };
  };

  // 停止日誌串流
  const stopLogStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  };

  // 自動滾動到底部
  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // 初始化
  useEffect(() => {
    fetchRecentLogs();
    fetchStats();
    
    // 定期更新統計資訊
    const statsInterval = setInterval(fetchStats, 10000);
    
    return () => {
      clearInterval(statsInterval);
      stopLogStream();
    };
  }, []);

  // 當過濾器改變時重新獲取日誌
  useEffect(() => {
    if (!isStreaming) {
      fetchRecentLogs();
    }
  }, [filters]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'DEBUG': return 'text-gray-500';
      case 'INFO': return 'text-blue-600';
      case 'WARN': return 'text-yellow-600';
      case 'ERROR': return 'text-red-600';
      default: return 'text-gray-700';
    }
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'DEBUG': return 'bg-gray-100 text-gray-800';
      case 'INFO': return 'bg-blue-100 text-blue-800';
      case 'WARN': return 'bg-yellow-100 text-yellow-800';
      case 'ERROR': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI 系統日誌監控</h1>
          <p className="text-gray-600">即時監控 AI 系統的運作狀態和訊息</p>
        </div>

        {/* 統計資訊 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">總日誌數</h3>
              <p className="text-2xl font-bold text-gray-900">{stats.totalLogs}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">錯誤數</h3>
              <p className="text-2xl font-bold text-red-600">{stats.levelStats.ERROR || 0}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">警告數</h3>
              <p className="text-2xl font-bold text-yellow-600">{stats.levelStats.WARN || 0}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">資訊數</h3>
              <p className="text-2xl font-bold text-blue-600">{stats.levelStats.INFO || 0}</p>
            </div>
          </div>
        )}

        {/* 控制面板 */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* 過濾器 */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">級別:</label>
              <select
                value={filters.level}
                onChange={(e) => setFilters(prev => ({ ...prev, level: e.target.value }))}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="all">全部</option>
                <option value="error">錯誤</option>
                <option value="warn">警告</option>
                <option value="info">資訊</option>
                <option value="debug">除錯</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">類別:</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="all">全部</option>
                <option value="TOOL">工具</option>
                <option value="Integration">整合</option>
                <option value="DockerConfig">Docker配置</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">行數:</label>
              <select
                value={filters.lines}
                onChange={(e) => setFilters(prev => ({ ...prev, lines: parseInt(e.target.value) }))}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>

            {/* 控制按鈕 */}
            <div className="flex items-center gap-2 ml-auto">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                />
                自動滾動
              </label>

              {!isStreaming ? (
                <button
                  onClick={startLogStream}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                >
                  開始即時監控
                </button>
              ) : (
                <button
                  onClick={stopLogStream}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                >
                  停止監控
                </button>
              )}

              <button
                onClick={fetchRecentLogs}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                重新整理
              </button>
            </div>
          </div>

          {isStreaming && (
            <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              即時監控中...
            </div>
          )}
        </div>

        {/* 日誌列表 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">系統日誌</h2>
          </div>
          
          <div
            ref={logsContainerRef}
            className="h-96 overflow-y-auto p-4 space-y-2"
          >
            {logs.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                暫無日誌記錄
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="border-l-4 border-gray-200 pl-4 py-2 hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getLevelBadgeColor(log.level)}`}>
                      {log.level}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                        <span className="text-gray-300">•</span>
                        <span className="font-medium">{log.category}</span>
                      </div>
                      <p className={`text-sm ${getLevelColor(log.level)} mb-1`}>
                        {log.message}
                      </p>
                      {log.data && (
                        <details className="text-xs text-gray-600">
                          <summary className="cursor-pointer hover:text-gray-800">詳細資料</summary>
                          <pre className="mt-1 p-2 bg-gray-100 rounded overflow-x-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        </details>
                      )}
                      {log.error && (
                        <p className="text-xs text-red-600 mt-1">
                          錯誤: {log.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 