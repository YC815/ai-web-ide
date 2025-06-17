/**
 * AI 工具控制框架使用範例
 * 展示如何使用 Agent 控制器進行各種操作
 */

import { AgentFactory } from './agent-factory';
import { logger } from '../logger';

/**
 * 基本使用範例
 */
export class AgentUsageExamples {

  /**
   * 範例 1: 快速使用 - 列出目錄內容
   */
  static async example1_QuickDirectoryListing(): Promise<void> {
    console.log('\n🔹 範例 1: 快速列出目錄內容');
    
    try {
      const factory = AgentFactory.getInstance();
      const result = await factory.quickRun("請幫我列出當前目錄的內容");
      
      console.log('✅ 執行結果:');
      console.log(result);
      
    } catch (error) {
      console.error('❌ 執行失敗:', error);
    }
  }

  /**
   * 範例 2: 尋找首頁檔案
   */
  static async example2_FindIndexFile(): Promise<void> {
    console.log('\n🔹 範例 2: 尋找首頁檔案');
    
    try {
      const factory = AgentFactory.getInstance();
      const result = await factory.quickRun("請幫我找出首頁的程式碼長怎樣");
      
      console.log('✅ 執行結果:');
      console.log(result);
      
    } catch (error) {
      console.error('❌ 執行失敗:', error);
    }
  }

  /**
   * 範例 3: 分析專案結構
   */
  static async example3_AnalyzeProjectStructure(): Promise<void> {
    console.log('\n🔹 範例 3: 分析專案結構');
    
    try {
      const factory = AgentFactory.getInstance();
      const result = await factory.quickRun(`
        請幫我分析這個專案的結構，包括：
        1. 主要目錄和檔案
        2. 使用的技術棧
        3. 專案類型（React、Next.js 等）
      `);
      
      console.log('✅ 執行結果:');
      console.log(result);
      
    } catch (error) {
      console.error('❌ 執行失敗:', error);
    }
  }

  /**
   * 範例 4: 使用自訂配置
   */
  static async example4_CustomConfiguration(): Promise<void> {
    console.log('\n🔹 範例 4: 使用自訂配置');
    
    try {
      const factory = AgentFactory.getInstance();
      
      // 自訂配置
      const config = {
        maxToolCalls: 3,        // 最多呼叫 3 次工具
        maxRetries: 1,          // 最多重試 1 次
        timeoutMs: 15000,       // 15 秒超時
        enableLogging: true,    // 啟用日誌
      };
      
      const result = await factory.quickRun(
        "請檢查 package.json 並告訴我這個專案的依賴套件",
        config
      );
      
      console.log('✅ 執行結果:');
      console.log(result);
      
    } catch (error) {
      console.error('❌ 執行失敗:', error);
    }
  }

  /**
   * 範例 5: 使用預設測試案例
   */
  static async example5_PredefinedTestCases(): Promise<void> {
    console.log('\n🔹 範例 5: 使用預設測試案例');
    
    try {
      const factory = AgentFactory.getInstance();
      
      // 執行不同的測試案例
      const testCases = [
        'LIST_DIRECTORY',
        'CHECK_PACKAGE_JSON',
        'FIND_REACT_COMPONENTS',
      ] as const;
      
      for (const testCase of testCases) {
        console.log(`\n📋 執行測試案例: ${testCase}`);
        const result = await factory.runTestCase(testCase);
        console.log(`✅ 結果: ${result.substring(0, 200)}...`);
      }
      
    } catch (error) {
      console.error('❌ 執行失敗:', error);
    }
  }

  /**
   * 範例 6: 系統測試和狀態檢查
   */
  static async example6_SystemTestAndStatus(): Promise<void> {
    console.log('\n🔹 範例 6: 系統測試和狀態檢查');
    
    try {
      const factory = AgentFactory.getInstance();
      
      // 檢查系統狀態
      console.log('📊 系統狀態:');
      const status = factory.getSystemStatus();
      console.log(JSON.stringify(status, null, 2));
      
      // 執行系統測試
      console.log('\n🧪 執行系統測試...');
      const testResult = await factory.testSystem();
      
      console.log('✅ 測試結果:');
      console.log(`成功: ${testResult.success}`);
      console.log(`訊息: ${testResult.message}`);
      console.log('詳細資訊:', JSON.stringify(testResult.details, null, 2));
      
    } catch (error) {
      console.error('❌ 執行失敗:', error);
    }
  }

  /**
   * 範例 7: 手動建立 Agent 控制器
   */
  static async example7_ManualAgentCreation(): Promise<void> {
    console.log('\n🔹 範例 7: 手動建立 Agent 控制器');
    
    try {
      const factory = AgentFactory.getInstance();
      
      // 手動建立 Agent 控制器
      const agent = await factory.createAgentController({
        enableLogging: true,
        maxToolCalls: 5,
      });
      
      // 使用 Agent 控制器執行多個任務
      const tasks = [
        "檢查是否有 README.md 檔案",
        "列出 src 目錄的內容",
        "找出所有的 TypeScript 檔案",
      ];
      
      for (const task of tasks) {
        console.log(`\n📝 執行任務: ${task}`);
        const result = await agent.runAgentController(task);
        console.log(`✅ 結果: ${result.substring(0, 150)}...`);
      }
      
    } catch (error) {
      console.error('❌ 執行失敗:', error);
    }
  }

  /**
   * 範例 8: 錯誤處理和重試機制
   */
  static async example8_ErrorHandlingAndRetry(): Promise<void> {
    console.log('\n🔹 範例 8: 錯誤處理和重試機制');
    
    try {
      const factory = AgentFactory.getInstance();
      
      // 嘗試讀取不存在的檔案（測試錯誤處理）
      const result = await factory.quickRun(
        "請讀取一個名為 'nonexistent-file.txt' 的檔案內容"
      );
      
      console.log('✅ 執行結果（應該包含錯誤處理）:');
      console.log(result);
      
    } catch (error) {
      console.error('❌ 執行失敗:', error);
    }
  }

  /**
   * 執行所有範例
   */
  static async runAllExamples(): Promise<void> {
    console.log('🚀 開始執行所有 AI 工具控制框架範例...\n');
    
    const examples = [
      this.example1_QuickDirectoryListing,
      this.example2_FindIndexFile,
      this.example3_AnalyzeProjectStructure,
      this.example4_CustomConfiguration,
      this.example5_PredefinedTestCases,
      this.example6_SystemTestAndStatus,
      this.example7_ManualAgentCreation,
      this.example8_ErrorHandlingAndRetry,
    ];
    
    for (let i = 0; i < examples.length; i++) {
      try {
        await examples[i]();
        console.log(`\n✅ 範例 ${i + 1} 執行完成`);
        
        // 在範例之間稍作停頓
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`\n❌ 範例 ${i + 1} 執行失敗:`, error);
      }
    }
    
    console.log('\n🎉 所有範例執行完成！');
  }
}

/**
 * 便捷函數：快速測試框架
 */
export async function quickTestAgent(message?: string): Promise<string> {
  const testMessage = message || "請幫我列出當前目錄的內容";
  const factory = AgentFactory.getInstance();
  return await factory.quickRun(testMessage);
}

/**
 * 便捷函數：執行系統診斷
 */
export async function systemDiagnostic(): Promise<any> {
  const factory = AgentFactory.getInstance();
  return await factory.testSystem();
}

// 如果直接執行此檔案，運行範例
if (require.main === module) {
  AgentUsageExamples.runAllExamples().catch(console.error);
} 