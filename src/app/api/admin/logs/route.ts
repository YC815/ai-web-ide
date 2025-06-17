import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/core/logger';
import fs from 'fs';
import path from 'path';

// 管理員日誌查看 API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'recent';
    const lines = parseInt(searchParams.get('lines') || '100');
    const level = searchParams.get('level') || 'all';
    const category = searchParams.get('category') || 'all';

    switch (action) {
      case 'recent':
        return handleRecentLogs(lines, level, category);
      
      case 'file':
        return handleLogFile(searchParams.get('date'));
      
      case 'stream':
        return handleLogStream();
      
      case 'stats':
        return handleLogStats();
      
      default:
        return NextResponse.json({
          success: false,
          error: '不支援的操作'
        }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    }, { status: 500 });
  }
}

/**
 * 獲取最近的日誌記錄
 */
async function handleRecentLogs(lines: number, level: string, category: string) {
  const recentLogs = logger.getRecentLogs(lines);
  
  // 過濾日誌
  let filteredLogs = recentLogs;
  
  if (level !== 'all') {
    const levelMap: { [key: string]: number } = {
      'debug': 0, 'info': 1, 'warn': 2, 'error': 3
    };
    const minLevel = levelMap[level.toLowerCase()];
    if (minLevel !== undefined) {
      filteredLogs = filteredLogs.filter(log => log.level >= minLevel);
    }
  }
  
  if (category !== 'all') {
    filteredLogs = filteredLogs.filter(log => 
      log.category.toLowerCase().includes(category.toLowerCase())
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      logs: filteredLogs.map(log => ({
        timestamp: log.timestamp,
        level: ['DEBUG', 'INFO', 'WARN', 'ERROR'][log.level],
        category: log.category,
        message: log.message,
        data: log.data,
        error: log.error?.message
      })),
      total: filteredLogs.length,
      filters: { level, category, lines }
    }
  });
}

/**
 * 獲取指定日期的日誌檔案
 */
async function handleLogFile(date?: string | null) {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    const targetDate = date || new Date().toISOString().split('T')[0];
    const logFile = path.join(logDir, `ai-creator-${targetDate}.log`);

    if (!fs.existsSync(logFile)) {
      return NextResponse.json({
        success: false,
        error: `日誌檔案不存在: ${targetDate}`
      }, { status: 404 });
    }

    const content = fs.readFileSync(logFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    return NextResponse.json({
      success: true,
      data: {
        date: targetDate,
        lines: lines.slice(-1000), // 最後 1000 行
        totalLines: lines.length,
        filePath: logFile
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `讀取日誌檔案失敗: ${error instanceof Error ? error.message : '未知錯誤'}`
    }, { status: 500 });
  }
}

/**
 * 日誌串流（Server-Sent Events）
 */
async function handleLogStream() {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      // 發送初始連接確認
      const data = `data: ${JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString(),
        message: '日誌串流已連接'
      })}\n\n`;
      controller.enqueue(encoder.encode(data));

      // 設定定期發送最新日誌
      const interval = setInterval(() => {
        try {
          const recentLogs = logger.getRecentLogs(10);
          if (recentLogs.length > 0) {
            const latestLog = recentLogs[recentLogs.length - 1];
            const data = `data: ${JSON.stringify({
              type: 'log',
              timestamp: latestLog.timestamp,
              level: ['DEBUG', 'INFO', 'WARN', 'ERROR'][latestLog.level],
              category: latestLog.category,
              message: latestLog.message,
              data: latestLog.data,
              error: latestLog.error?.message
            })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
        } catch (error) {
          console.error('日誌串流錯誤:', error);
        }
      }, 2000); // 每 2 秒發送一次

      // 清理函數
      return () => {
        clearInterval(interval);
      };
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
}

/**
 * 獲取日誌統計資訊
 */
async function handleLogStats() {
  try {
    const recentLogs = logger.getRecentLogs(1000);
    
    // 統計各級別日誌數量
    const levelStats = recentLogs.reduce((acc, log) => {
      const levelName = ['DEBUG', 'INFO', 'WARN', 'ERROR'][log.level];
      acc[levelName] = (acc[levelName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 統計各類別日誌數量
    const categoryStats = recentLogs.reduce((acc, log) => {
      acc[log.category] = (acc[log.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 獲取可用的日誌檔案
    const logDir = path.join(process.cwd(), 'logs');
    let availableFiles: string[] = [];
    
    if (fs.existsSync(logDir)) {
      availableFiles = fs.readdirSync(logDir)
        .filter(file => file.startsWith('ai-creator-') && file.endsWith('.log'))
        .sort()
        .reverse();
    }

    return NextResponse.json({
      success: true,
      data: {
        totalLogs: recentLogs.length,
        levelStats,
        categoryStats,
        availableFiles,
        logFilePath: logger.getLogFilePath(),
        lastUpdate: new Date().toISOString()
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `獲取統計資訊失敗: ${error instanceof Error ? error.message : '未知錯誤'}`
    }, { status: 500 });
  }
} 