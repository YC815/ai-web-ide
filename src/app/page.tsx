import { ChatInterface } from './components/ChatInterface';
import { PreviewPanel } from './components/PreviewPanel';

export default function Home() {
  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-900">
      {/* 左側：聊天與 TODO 管理區域 */}
      <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <ChatInterface />
      </div>
      
      {/* 右側：Next.js 實時預覽區域 */}
      <div className="w-1/2 flex flex-col">
        <PreviewPanel />
      </div>
    </div>
  );
}
