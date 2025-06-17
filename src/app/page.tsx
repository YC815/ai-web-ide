import { ProjectDashboard } from './components/Project/ProjectDashboard';
import DockerStatusMonitor from '@/components/DockerStatusMonitor';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 全局標題列 */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🤖</span>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  AI Web IDE
                </h1>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                容器化開發環境管理平台
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* 全局操作按鈕 */}
              <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                <span className="mr-2">➕</span>
                新建專案
              </button>
              
              <button className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <span className="mr-2">🐳</span>
                容器總覽
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 主內容區域 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Docker 狀態監控面板 */}
        <div className="mb-8">
          <DockerStatusMonitor autoRefresh={true} refreshInterval={15000} />
        </div>

        {/* 專案控制台 */}
        <ProjectDashboard />
      </main>
    </div>
  );
}
