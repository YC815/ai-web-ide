'use client';

import dynamic from 'next/dynamic';

// 動態導入 DockerStatusMonitor，禁用 SSR 以避免 hydration 問題
const DockerStatusMonitor = dynamic(() => import('@/components/DockerStatusMonitor'), {
  ssr: false,
  loading: () => (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Docker 容器狀態監控
        </h3>
        <div className="text-sm text-gray-500">載入中...</div>
      </div>
      <div className="text-center py-8">
        <div className="text-2xl mb-2">🔄</div>
        <p className="text-gray-600">正在初始化監控系統...</p>
      </div>
    </div>
  )
});

interface DockerStatusWrapperProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export default function DockerStatusWrapper({ 
  autoRefresh = true, 
  refreshInterval = 15000 
}: DockerStatusWrapperProps) {
  return <DockerStatusMonitor autoRefresh={autoRefresh} refreshInterval={refreshInterval} />;
} 