'use client';

import { useState, useEffect } from 'react';
import { ProjectCard } from './ProjectCard';
import { ProjectFilters } from './ProjectFilters';

// 專案資料介面定義
interface Project {
  id: string;
  name: string;
  description: string;
  lastUpdated: string;
  status: 'running' | 'stopped' | 'error';
  containerId: string;
  createdAt: string;
}

// 容器狀態標籤樣式
const getStatusBadge = (status: Project['status']) => {
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  
  switch (status) {
    case 'running':
      return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300`;
    case 'stopped':
      return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300`;
    case 'error':
      return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300`;
    default:
      return `${baseClasses} bg-gray-100 text-gray-800`;
  }
};

// 容器操作按鈕
const ActionButton = ({ 
  onClick, 
  variant, 
  children 
}: { 
  onClick: () => void; 
  variant: 'start' | 'stop' | 'delete' | 'open';
  children: React.ReactNode;
}) => {
  const baseClasses = 'inline-flex items-center px-3 py-1 border text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    start: 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100 focus:ring-green-500 dark:border-green-600 dark:text-green-400 dark:bg-green-900/20 dark:hover:bg-green-900/40',
    stop: 'border-yellow-300 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:ring-yellow-500 dark:border-yellow-600 dark:text-yellow-400 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/40',
    delete: 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100 focus:ring-red-500 dark:border-red-600 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/40',
    open: 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 focus:ring-blue-500 dark:border-blue-600 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/40'
  };
  
  return (
    <button 
      onClick={onClick} 
      className={`${baseClasses} ${variantClasses[variant]}`}
    >
      {children}
    </button>
  );
};

// 專案卡片組件
const ProjectCard = ({ project, onAction }: { 
  project: Project; 
  onAction: (action: string, projectId: string) => void;
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
      {/* 專案標題與狀態 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {project.name}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {project.description}
          </p>
        </div>
        <span className={getStatusBadge(project.status)}>
          {project.status === 'running' ? '🟢 運行中' : 
           project.status === 'stopped' ? '⚪ 已停止' : '🔴 錯誤'}
        </span>
      </div>
      
      {/* 專案資訊 */}
      <div className="mb-4 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">最後更新</span>
          <span className="text-gray-700 dark:text-gray-300">{project.lastUpdated}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">容器 ID</span>
          <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">
            {project.containerId.substring(0, 12)}...
          </span>
        </div>
      </div>
      
      {/* 操作按鈕 */}
      <div className="flex flex-wrap gap-2">
        <ActionButton 
          variant="open" 
          onClick={() => onAction('open', project.id)}
        >
          📝 開啟專案
        </ActionButton>
        
        {project.status === 'stopped' ? (
          <ActionButton 
            variant="start" 
            onClick={() => onAction('start', project.id)}
          >
            ▶️ 啟動
          </ActionButton>
        ) : project.status === 'running' ? (
          <ActionButton 
            variant="stop" 
            onClick={() => onAction('stop', project.id)}
          >
            ⏹️ 停止
          </ActionButton>
        ) : null}
        
        <ActionButton 
          variant="delete" 
          onClick={() => onAction('delete', project.id)}
        >
          🗑️ 刪除
        </ActionButton>
      </div>
    </div>
  );
};

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
  
  // 獲取專案列表
  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/containers');
      const result = await response.json();
      
      if (result.success) {
        setProjects(result.data);
      } else {
        console.error('獲取專案列表失敗:', result.error);
        // 如果 API 失敗，顯示空列表而不是模擬數據
        setProjects([]);
      }
    } catch (error) {
      console.error('獲取專案列表出錯:', error);
      // 網路錯誤時也顯示空列表
      setProjects([]);
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
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  
  // 處理專案操作
  const handleProjectAction = async (action: string, projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    try {
      switch (action) {
        case 'open':
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
                ? { ...p, status: action === 'start' ? 'running' : 'stopped' }
                : p
            ));
            alert(`容器${action === 'start' ? '啟動' : '停止'}成功！`);
          } else {
            alert(`操作失敗: ${result.error}`);
          }
          break;
          
        case 'delete':
          if (confirm(`確定要刪除專案 "${project.name}" 及其所有容器資源嗎？此操作無法恢復。`)) {
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
            
            const result = await response.json();
            if (result.success) {
              // 從本地狀態中移除
              setProjects(prev => prev.filter(p => p.id !== projectId));
              alert('專案刪除成功！');
            } else {
              alert(`刪除失敗: ${result.error}`);
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
        alert(`創建失敗: ${result.error}`);
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
              {projects.filter(p => p.status === 'running').length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">運行中</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {projects.filter(p => p.status === 'stopped').length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">已停止</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {projects.filter(p => p.status === 'error').length}
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
          {!searchTerm && statusFilter === 'all' && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
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
              onAction={handleProjectAction}
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