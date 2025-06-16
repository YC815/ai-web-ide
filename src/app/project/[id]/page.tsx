import { notFound } from 'next/navigation';

interface Props {
  params: {
    id: string;
  };
}

// 模擬獲取專案資訊的函數
async function getProject(id: string) {
  // TODO: 替換為真實的 API 調用
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/containers`);
    const result = await response.json();
    
    if (result.success) {
      const project = result.data.find((p: any) => p.id === id);
      return project || null;
    }
    return null;
  } catch (error) {
    console.error('獲取專案資訊失敗:', error);
    return null;
  }
}

export default async function ProjectPage({ params }: Props) {
  const project = await getProject(params.id);
  
  if (!project) {
    notFound();
  }
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 頂部導航欄 */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              {/* 返回按鈕 */}
              <a
                href="/"
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="mr-2">←</span>
                返回首頁
              </a>
              
              {/* 專案資訊 */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">📝</span>
                  <div>
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {project.name}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      容器: {project.containerId.substring(0, 12)}...
                    </p>
                  </div>
                </div>
                
                {/* 狀態指示器 */}
                <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  project.status === 'running' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                    : project.status === 'stopped'
                    ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                }`}>
                  {project.status === 'running' ? '🟢 運行中' : 
                   project.status === 'stopped' ? '⚪ 已停止' : '🔴 錯誤'}
                </div>
              </div>
            </div>
            
            {/* 頂部操作按鈕 */}
            <div className="flex items-center space-x-4">
              <button className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                <span className="mr-2">🔧</span>
                設定
              </button>
              
              <button className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                <span className="mr-2">💾</span>
                存檔
              </button>
              
              <button className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                <span className="mr-2">🚀</span>
                部署
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 主要內容區域 */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* 左側面板 - 聊天與 TODO */}
        <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-gray-700">
          {/* Tab 切換 */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <button className="flex-1 px-4 py-3 text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 border-b-2 border-blue-600">
              💬 AI 聊天
            </button>
            <button className="flex-1 px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              ✅ TODO 列表
            </button>
          </div>
          
          {/* 聊天區域 */}
          <div className="flex-1 flex flex-col bg-white dark:bg-gray-800">
            {/* 聊天訊息區域 */}
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="space-y-4">
                {/* 歡迎訊息 */}
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm">🤖</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                      <p className="text-sm text-gray-900 dark:text-white">
                        歡迎來到 <strong>{project.name}</strong> 專案！我是您的 AI 助手，可以幫助您：
                      </p>
                      <ul className="mt-2 text-sm text-gray-700 dark:text-gray-300 list-disc list-inside space-y-1">
                        <li>編寫和修改程式碼</li>
                        <li>生成 React 組件</li>
                        <li>管理專案依賴</li>
                        <li>解決錯誤和問題</li>
                        <li>優化程式碼結構</li>
                      </ul>
                      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                        請告訴我您想要做什麼？
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {new Date().toLocaleTimeString('zh-TW')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 輸入區域 */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-end space-x-3">
                <div className="flex-1">
                  <textarea
                    placeholder="輸入您的需求或問題..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                    rows={3}
                  />
                </div>
                <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                  <span className="mr-2">📤</span>
                  發送
                </button>
              </div>
              
              {/* Token 統計 */}
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Token 使用: 0 / 本次對話成本: $0.00</span>
                <span>最後更新: {new Date().toLocaleString('zh-TW')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 右側面板 - 實時預覽 */}
        <div className="w-1/2 flex flex-col bg-white dark:bg-gray-800">
          {/* 預覽控制欄 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">實時預覽</h3>
              
              {/* 環境切換 */}
              <select className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white">
                <option>開發模式</option>
                <option>預覽模式</option>
                <option>生產模式</option>
              </select>
            </div>
            
            {/* 裝置模擬切換 */}
            <div className="flex items-center space-x-2">
              <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-300 dark:border-gray-600 rounded">
                <span>💻</span>
              </button>
              <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-300 dark:border-gray-600 rounded">
                <span>📱</span>
              </button>
              <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-300 dark:border-gray-600 rounded">
                <span>🔄</span>
              </button>
            </div>
          </div>
          
          {/* 預覽區域 */}
          <div className="flex-1 p-4">
            <div className="w-full h-full bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl mb-4">🚧</div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  預覽功能開發中
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Next.js 實時預覽將在此顯示
                </p>
                <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                  容器狀態: {project.status}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 