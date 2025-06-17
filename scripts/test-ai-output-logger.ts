#!/usr/bin/env tsx

/**
 * AI 輸出記錄器測試腳本
 * 用於驗證AI輸出記錄器的基本功能
 */

import { runAllLoggerExamples } from '../src/lib/ai/ai-output-logger-example';

async function main() {
  console.log('🧪 開始測試 AI 輸出記錄器...\n');

  try {
    await runAllLoggerExamples();
    console.log('\n✅ AI 輸出記錄器測試完成！');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ AI 輸出記錄器測試失敗:', error);
    process.exit(1);
  }
}

// 執行測試
main(); 