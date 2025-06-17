import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // 檢查是否為 docker-status API 請求
  if (request.nextUrl.pathname === '/api/docker-status') {
    // 設定響應標頭以避免日誌輸出
    const response = NextResponse.next();
    
    // 添加自定義標頭標記這是靜默請求
    response.headers.set('x-silent-request', 'true');
    
    return response;
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/docker-status',
    '/api/docker-status/:path*'
  ]
}; 