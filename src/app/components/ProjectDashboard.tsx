'use client';

import { useState, useEffect } from 'react';
import { ProjectCard } from './ProjectCard';

// 專案資料介面定義
interface Project {
  id: string;
  name: string;
  description: string;
  lastUpdated: Date;
  containerStatus: 'running' | 'stopped' | 'error';
  containerId: string;
  createdAt: string;
  framework: 'next' | 'react' | 'vue' | 'angular' | 'other';
  recentTodos: {
    id: string;
    text: string;
    completed: boolean;
  }[];
  stats: {
    totalFiles: number;
    totalTodos: number;
    completedTodos: number;
  };
}





// 使用導入的 ProjectCard 組件

// 新建專案模態框
const CreateProjectModal = ({ 
  isOpen, 
  onClose, 
  onSubmit 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSubmit: (data: { name: string; description: string }) => void;
}) => {
  const [formData, setFormData] = useState({ name: '', description: '' });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim()) {
      onSubmit(formData);
      setFormData({ name: '', description: '' });
      onClose();
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          創建新專案
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              專案名稱 *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="輸入專案名稱"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              專案描述
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="簡短描述專案內容（可選）"
              rows={3}
            />
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              創建專案
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 主要 ProjectDashboard 組件
export function ProjectDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [dockerError, setDockerError] = useState<string | null>(null);
  const [dockerDebugOutput, setDockerDebugOutput] = useState<string | null>(null);
  
  // 獲取專案列表
  const fetchProjects = async () => {
    try {
      setLoading(true);
      setDockerError(null);
      const response = await fetch('/api/containers');
      const result = await response.json();
      
      if (result.success) {
        // 轉換 API 回應格式以符合 ProjectCard 期望的介面
        const transformedProjects = result.data.map((project: {
          id: string;
          name: string;
          description: string;
          lastUpdated: string;
          status: string;
          containerId: string;
          createdAt: string;
        }) => ({
          ...project,
          lastUpdated: new Date(project.lastUpdated),
          containerStatus: project.status,
          framework: 'next' as const, // 預設為 Next.js
          recentTodos: [
            { id: '1', text: '設定專案環境', completed: true },
            { id: '2', text: '建立基礎結構', completed: false },
            { id: '3', text: '實作核心功能', completed: false }
          ],
          stats: {
            totalFiles: Math.floor(Math.random() * 50) + 10,
            totalTodos: 3,
            completedTodos: 1
          }
        }));
        
        setProjects(transformedProjects);
        
        // 如果沒有專案但有調試輸出，保存調試信息
        if (transformedProjects.length === 0 && result.debugOutput) {
          setDockerDebugOutput(result.debugOutput);
        } else {
          setDockerDebugOutput(null);
        }
      } else {
        console.error('獲取專案列表失敗:', result.error);
        setProjects([]);
        
        // 如果是 Docker 錯誤，顯示詳細信息
        if (result.dockerError) {
          setDockerError(result.details || result.error);
        }
      }
    } catch (error) {
      console.error('獲取專案列表出錯:', error);
      setProjects([]);
      setDockerError(`網路錯誤: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);
  
  // 過濾專案
  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.containerStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });
  
  // 處理專案操作
  const handleProjectAction = async (action: 'start' | 'stop' | 'delete' | 'enter', projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    try {
      switch (action) {
        case 'enter':
          // 導航到專案工作區
          window.location.href = `/project/${projectId}`;
          break;
          
        case 'start':
        case 'stop':
          const response = await fetch('/api/containers', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action,
              containerId: project.containerId
            })
          });
          
          const result = await response.json();
          if (result.success) {
            // 更新本地狀態
            setProjects(prev => prev.map(p => 
              p.id === projectId 
                ? { ...p, containerStatus: action === 'start' ? 'running' : 'stopped' }
                : p
            ));
            alert(`容器${action === 'start' ? '啟動' : '停止'}成功！`);
          } else {
            const errorMsg = result.dockerError ? 
              `Docker 錯誤: ${result.details || result.error}` : 
              `操作失敗: ${result.error}`;
            alert(errorMsg);
          }
          break;
          
        case 'delete':
          if (confirm(`確定要刪除專案 "${project.name}" 及其所有容器資源嗎？此操作無法恢復。`)) {
            // 顯示刪除進度
            let progressAlert: NodeJS.Timeout | null = null;
            
            try {
              // 顯示刪除進度提示
              progressAlert = setTimeout(() => {
                alert('正在刪除專案，請稍候...\n如果容器正在運行，系統會自動重試多次以確保刪除成功。');
              }, 500);
              
              const response = await fetch('/api/containers', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  action: 'delete',
                  containerId: project.containerId
                })
              });
              
              // 清除進度提示
              if (progressAlert) {
                clearTimeout(progressAlert);
                progressAlert = null;
              }
              
              const result = await response.json();
              if (result.success) {
                // 從本地狀態中移除
                setProjects(prev => prev.filter(p => p.id !== projectId));
                alert('專案刪除成功！');
              } else {
                const errorMsg = result.dockerError ? 
                  `Docker 錯誤: ${result.details || result.error}` : 
                  `刪除失敗: ${result.error}`;
                alert(errorMsg);
              }
            } catch (error) {
              // 清除進度提示
              if (progressAlert) {
                clearTimeout(progressAlert);
              }
              throw error; // 重新拋出錯誤讓外層處理
            }
          }
          break;
      }
    } catch (error) {
      console.error('操作失敗:', error);
      alert('操作失敗，請檢查網路連接或稍後重試');
    }
  };
  
  // 處理創建新專案
  const handleCreateProject = async (data: { name: string; description: string }) => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/containers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          projectName: data.name,
          description: data.description
        })
      });
      
      const result = await response.json();
      if (result.success) {
        // 添加到本地狀態
        setProjects(prev => [...prev, result.data]);
        alert(`專案 "${data.name}" 創建成功！`);
      } else {
        const errorMsg = result.dockerError ? 
          `Docker 錯誤: ${result.details || result.error}` : 
          `創建失敗: ${result.error}`;
        alert(errorMsg);
      }
    } catch (error) {
      console.error('創建專案失敗:', error);
      alert('創建專案失敗，請檢查網路連接或稍後重試');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">載入專案列表中...</span>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Docker 錯誤提示 */}
      {dockerError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <span className="text-red-500 text-xl">⚠️</span>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
                Docker 環境錯誤
              </h3>
              <p className="text-sm text-red-700 dark:text-red-400 mb-2">
                無法連接到 Docker 服務，請確保 Docker 已正確安裝並運行。
              </p>
              <details className="text-xs">
                <summary className="cursor-pointer text-red-600 dark:text-red-400 hover:text-red-500">
                  查看詳細錯誤信息
                </summary>
                <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/40 rounded text-red-800 dark:text-red-300 whitespace-pre-wrap">
                  {dockerError}
                </pre>
              </details>
            </div>
            <button 
              onClick={() => setDockerError(null)}
              className="flex-shrink-0 text-red-500 hover:text-red-700 dark:hover:text-red-300"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 頁面標題和統計 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">專案管理</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            管理您的容器化開發專案，共 {projects.length} 個專案
          </p>
        </div>

        {/* 快速狀態統計 */}
        <div className="flex items-center space-x-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {projects.filter(p => p.containerStatus === 'running').length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">運行中</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {projects.filter(p => p.containerStatus === 'stopped').length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">已停止</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {projects.filter(p => p.containerStatus === 'error').length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">錯誤</div>
          </div>
        </div>
      </div>

      {/* 搜尋與過濾控制 */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          {/* 搜尋框 */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋專案名稱或描述..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400">🔍</span>
            </div>
          </div>
          
          {/* 狀態過濾 */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">所有狀態</option>
            <option value="running">運行中</option>
            <option value="stopped">已停止</option>
            <option value="error">錯誤</option>
          </select>
        </div>
        
        {/* 新建專案按鈕 */}
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          <span className="mr-2">➕</span>
          新建專案
        </button>
      </div>

      {/* 專案卡片網格 */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchTerm || statusFilter !== 'all' ? '沒有找到符合條件的專案' : '還沒有任何專案'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {searchTerm || statusFilter !== 'all' 
              ? '嘗試調整搜尋條件或過濾器' 
              : '點擊「新建專案」按鈕開始你的第一個專案'}
          </p>
          
          {/* Docker 調試輸出 */}
          {dockerDebugOutput && !searchTerm && statusFilter === 'all' && (
            <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-left max-w-4xl mx-auto">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                🔍 Docker 容器調試信息
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                以下是當前系統中所有 Docker 容器的列表（包含 ai-web-ide 前綴的會被識別為專案）：
              </p>
              <pre className="text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 p-3 rounded border overflow-x-auto">
                {dockerDebugOutput}
              </pre>
            </div>
          )}
          
          {!searchTerm && statusFilter === 'all' && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors mt-4"
            >
              <span className="mr-2">➕</span>
              新建專案
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onAction={(action) => handleProjectAction(action, project.id)}
            />
          ))}
        </div>
      )}

      {/* 創建專案模態框 */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateProject}
      />

      {/* 底部統計資訊 */}
      <div className="mt-8 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            顯示 {filteredProjects.length} / {projects.length} 個專案
          </span>
          <span>
            上次更新: {new Date().toLocaleString('zh-TW')}
          </span>
        </div>
      </div>
    </div>
  );
} 