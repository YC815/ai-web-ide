import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          找不到專案
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          您要查找的專案不存在或已被刪除
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          <span className="mr-2">←</span>
          返回首頁
        </Link>
      </div>
    </div>
  );
} 