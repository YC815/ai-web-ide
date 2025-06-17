'use client';

import { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChatInterface } from '../../components/Chat/ChatInterface';
import { PreviewPanel } from '../../components/Project/PreviewPanel';

interface Props {
  params: Promise<{
    id: string;
  }>;
}

interface Project {
  id: string;
  name: string;
  description: string;
  lastUpdated: string;
  status: 'running' | 'stopped' | 'error';
  containerId: string;
  createdAt: string;
}

// 獲取專案資訊的函數
async function getProject(id: string): Promise<Project | null> {
  console.log(`[ProjectPage] 開始獲取專案資訊, ID: ${id}`);
  
  try {
    console.log(`[ProjectPage] 發送請求到 /api/containers`);
    
    const response = await fetch('/api/containers', {
      cache: 'no-store',
    });
    
    console.log(`[ProjectPage] API 回應狀態: ${response.status}`);
    
    if (!response.ok) {
      console.error(`[ProjectPage] API 請求失敗: ${response.status} ${response.statusText}`);
      throw new Error('Failed to fetch projects');
    }
    
    const result = await response.json();
    console.log(`[ProjectPage] API 回應結果:`, result);
    
    if (result.success) {
      console.log(`[ProjectPage] 成功獲取 ${result.data.length} 個專案`);
      const project = result.data.find((p: Project) => p.id === id);
      console.log(`[ProjectPage] 尋找專案 ${id}:`, project ? '找到' : '未找到', project);
      return project || null;
    }
    console.log(`[ProjectPage] API 回應失敗:`, result);
    return null;
  } catch (error) {
    console.error('[ProjectPage] 獲取專案資訊失敗:', error);
    return null;
  }
}

export default function ProjectPage({ params }: Props) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'todo'>('chat');
  const [error, setError] = useState<string | null>(null);

  
  // 載入專案資訊
  useEffect(() => {
    const loadProject = async () => {
      try {
        console.log(`[ProjectPage] useEffect 觸發，開始載入專案`);
        setLoading(true);
        setError(null);
        
        const resolvedParams = await params;
        console.log(`[ProjectPage] 解析 params:`, resolvedParams);
        
        const projectId = resolvedParams.id;
        console.log(`[ProjectPage] 專案 ID: ${projectId}`);
        
        const projectData = await getProject(projectId);
        console.log(`[ProjectPage] 載入專案結果:`, projectData);
        
        if (projectData) {
          setProject(projectData);
          console.log(`[ProjectPage] 專案載入成功: ${projectData.name}`);
        } else {
          console.log(`[ProjectPage] 專案未找到: ${projectId}`);
          setError(`專案未找到: ${projectId}`);
        }
      } catch (err) {
        console.error(`[ProjectPage] 載入專案時發生錯誤:`, err);
        setError(err instanceof Error ? err.message : '載入專案時發生未知錯誤');
      } finally {
        setLoading(false);
        console.log(`[ProjectPage] 載入完成`);
      }
    };
    
    loadProject();
  }, [params]);
  
  if (loading) {
    console.log(`[ProjectPage] 顯示載入畫面`);
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <span className="mt-2 text-gray-600 dark:text-gray-400">載入專案中...</span>
          <div className="mt-4 text-xs text-gray-500">
            檢查 console 查看詳細載入過程
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    console.log(`[ProjectPage] 顯示錯誤訊息: ${error}`);
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">載入錯誤</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            返回首頁
          </button>
        </div>
      </div>
    );
  }
  
  if (!project) {
    console.log(`[ProjectPage] 專案為 null，顯示 not found`);
    notFound();
  }
  
  console.log(`[ProjectPage] 渲染專案頁面: ${project.name}`);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 頂部導航欄 */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              {/* 返回按鈕 */}
              <Link
                href="/"
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="mr-2">←</span>
                返回首頁
              </Link>
              
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
        <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-gray-700 h-full">
          {/* Tab 切換 */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
            <button 
              onClick={() => setActiveTab('chat')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'chat'
                  ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 border-b-2 border-blue-600'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              💬 AI 聊天
            </button>
            <button 
              onClick={() => setActiveTab('todo')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'todo'
                  ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 border-b-2 border-blue-600'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              ✅ TODO 列表
            </button>
          </div>
          
          {/* 內容區域 */}
          <div className="flex-1 min-h-0">
            {activeTab === 'chat' ? (
              <ChatInterface 
                projectName={project.name} 
                projectId={project.id}
                containerId={project.containerId}
              />
            ) : (
              <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 h-full">
                <div className="flex-1 p-4">
                  <div className="text-center py-12">
                    <div className="text-4xl mb-4">📝</div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      TODO 功能開發中
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      專案任務管理功能即將推出
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右側面板 - 實時預覽 */}
        <div className="w-1/2 flex flex-col h-full">
          <PreviewPanel containerId={project.containerId} projectStatus={project.status} />
        </div>
      </div>
    </div>
  );
} 