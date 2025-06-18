#!/usr/bin/env npx ts-node

/**
 * 測試容器動態切換功能
 * 驗證系統能否根據不同專案正確切換到對應的 Docker 容器
 */

interface TestResult {
  test: string;
  success: boolean;
  output?: string;
  error?: string;
}

async function testContainerSwitching(): Promise<void> {
  console.log('🧪 開始測試容器動態切換功能');
  console.log('='.repeat(60));
  
  const tests: TestResult[] = [];
  
  // 測試 1: 獲取容器列表
  console.log('\n🔍 測試 1: 獲取可用的容器列表');
  try {
    const response = await fetch('http://localhost:3000/api/containers');
    const data = await response.json();
    
    if (data.success && data.data.length > 0) {
      tests.push({
        test: '獲取容器列表',
        success: true,
        output: `找到 ${data.data.length} 個容器`
      });
      
      console.log('✅ 成功獲取容器列表:');
      data.data.forEach((container: any) => {
        console.log(`  - ${container.name} (${container.containerId}) - ${container.status}`);
      });
      
      // 測試 2: 針對每個運行中的容器測試聊天 API
      const runningContainers = data.data.filter((c: any) => c.status === 'running');
      
      for (const container of runningContainers) {
        console.log(`\n🤖 測試 2.${runningContainers.indexOf(container) + 1}: 測試容器 ${container.name} 的聊天功能`);
        
        try {
          const chatResponse = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: '檢查當前專案狀態',
              projectId: container.id,
              projectName: container.name,
              containerId: container.containerId,
              apiToken: process.env.OPENAI_API_KEY || 'test-key',
              useLangchain: true
            })
          });
          
          if (chatResponse.ok) {
            tests.push({
              test: `聊天 API - ${container.name}`,
              success: true,
              output: '聊天 API 響應正常'
            });
            console.log(`  ✅ 聊天 API 響應正常`);
          } else {
            const errorData = await chatResponse.json();
            tests.push({
              test: `聊天 API - ${container.name}`,
              success: false,
              error: errorData.error || '未知錯誤'
            });
            console.log(`  ❌ 聊天 API 失敗: ${errorData.error}`);
          }
        } catch (error) {
          tests.push({
            test: `聊天 API - ${container.name}`,
            success: false,
            error: error instanceof Error ? error.message : '未知錯誤'
          });
          console.log(`  ❌ 聊天 API 錯誤: ${error}`);
        }
        
        // 測試 3: 測試開發服務器狀態檢查
        console.log(`\n🔧 測試 3.${runningContainers.indexOf(container) + 1}: 測試容器 ${container.name} 的開發服務器狀態`);
        
        try {
          const devServerResponse = await fetch(`http://localhost:3000/api/docker-dev-server?containerId=${container.containerId}`);
          const devServerData = await devServerResponse.json();
          
          if (devServerData.success) {
            tests.push({
              test: `開發服務器狀態 - ${container.name}`,
              success: true,
              output: `狀態: ${devServerData.status}, 端口: ${devServerData.port || 'N/A'}`
            });
            console.log(`  ✅ 開發服務器狀態: ${devServerData.status}`);
            if (devServerData.port) {
              console.log(`     端口: ${devServerData.port}`);
            }
          } else {
            tests.push({
              test: `開發服務器狀態 - ${container.name}`,
              success: false,
              error: devServerData.error || '未知錯誤'
            });
            console.log(`  ❌ 開發服務器狀態檢查失敗: ${devServerData.error}`);
          }
        } catch (error) {
          tests.push({
            test: `開發服務器狀態 - ${container.name}`,
            success: false,
            error: error instanceof Error ? error.message : '未知錯誤'
          });
          console.log(`  ❌ 開發服務器狀態檢查錯誤: ${error}`);
        }
      }
      
    } else {
      tests.push({
        test: '獲取容器列表',
        success: false,
        error: '沒有找到任何容器'
      });
      console.log('❌ 沒有找到任何容器');
    }
  } catch (error) {
    tests.push({
      test: '獲取容器列表',
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    });
    console.log(`❌ 獲取容器列表失敗: ${error}`);
  }
  
  // 測試總結
  console.log('\n' + '='.repeat(60));
  console.log('📊 測試結果總結');
  console.log('='.repeat(60));
  
  const successCount = tests.filter(t => t.success).length;
  const failCount = tests.filter(t => !t.success).length;
  
  console.log(`✅ 成功: ${successCount}`);
  console.log(`❌ 失敗: ${failCount}`);
  console.log(`📊 總計: ${tests.length}`);
  
  if (failCount > 0) {
    console.log('\n❌ 失敗的測試:');
    tests.filter(t => !t.success).forEach(test => {
      console.log(`  - ${test.test}: ${test.error}`);
    });
  }
  
  console.log('\n🔍 關鍵發現:');
  
  if (successCount === tests.length) {
    console.log('✅ 所有測試都通過！容器動態切換功能正常工作。');
  } else if (successCount > 0) {
    console.log('⚠️ 部分測試通過，系統基本功能正常，但有些問題需要解決。');
  } else {
    console.log('❌ 所有測試都失敗，容器動態切換功能存在問題。');
  }
  
  console.log('\n💡 建議:');
  console.log('1. 確保 Next.js 開發服務器正在運行 (npm run dev)');
  console.log('2. 確保至少有一個 Docker 容器正在運行');
  console.log('3. 檢查 API 路由是否正確配置');
  console.log('4. 如果使用聊天功能，請設置 OPENAI_API_KEY 環境變量');
  
  console.log('\n🐳 容器動態切換測試完成');
}

// 執行測試
if (require.main === module) {
  testContainerSwitching().catch(console.error);
} 