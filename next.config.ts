import type { NextConfig } from "next";

// 在開發模式下過濾 Docker API 請求日誌
if (process.env.NODE_ENV === 'development') {
  const originalLog = console.log;
  const originalInfo = console.info;
  
  console.log = (...args: any[]) => {
    const message = args.join(' ');
    if (message.includes('/api/docker-status') && message.includes('200 in')) {
      return; // 靜默處理 docker-status API 請求
    }
    originalLog.apply(console, args);
  };
  
  console.info = (...args: any[]) => {
    const message = args.join(' ');
    if (message.includes('/api/docker-status') && message.includes('200 in')) {
      return; // 靜默處理 docker-status API 請求
    }
    originalInfo.apply(console, args);
  };
}

const nextConfig: NextConfig = {
  /* config options here */
  
  // 完全禁用 API 路由的請求日誌
  ...(process.env.NODE_ENV === 'development' && {
    onDemandEntries: {
      // 減少開發模式下的日誌輸出
      maxInactiveAge: 25 * 1000,
      pagesBufferLength: 2,
    },
  }),
  
  // 自定義 webpack 設定以禁用特定日誌
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // 在開發模式下減少日誌輸出
      config.infrastructureLogging = {
        level: 'error',
      };
    }
    return config;
  },
};

export default nextConfig;
