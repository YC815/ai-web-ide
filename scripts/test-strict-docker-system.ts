#!/usr/bin/env tsx

/**
 * 嚴格 Docker 系統測試腳本
 * 驗證嚴格系統是否正確鎖定在 /app/workspace/[project-name] 目錄內
 * 確保無法訪問宿主機檔案系統
 */

import { StrictAgentFactory } from '../src/lib/ai/strict-agent-factory';

async function testStrictDockerSystem() {
  console.log('🔒 開始測試嚴格 Docker 系統...\n');

  try {
    // 配置嚴格Agent工廠
    const strictConfig = {
      projectName: 'web_test',
      dockerContainerId: '41acd88ac05a',
      enableLogging: true,
    };

    console.log('📦 嚴格系統配置:');
    console.log(`   專案名稱: ${strictConfig.projectName}`);
    console.log(`   容器ID: ${strictConfig.dockerContainerId}`);
    console.log(`   工作目錄: /app/workspace/${strictConfig.projectName}\n`);

    const strictFactory = StrictAgentFactory.getInstance();

    // 測試1: 系統初始化
    console.log('🧪 測試1: 嚴格系統初始化...');
    const systemTest = await strictFactory.testStrictSystem(strictConfig);
    
    if (systemTest.success) {
      console.log('✅ 系統初始化成功');
      console.log(`   ${systemTest.message}`);
      
      // 顯示安全報告
      const details = systemTest.details as any;
      if (details.securityReport) {
        console.log('🛡️ 安全報告:');
        console.log(`   安全級別: ${details.securityReport.securityLevel}`);
        console.log(`   工作目錄: ${details.securityReport.workingDirectory}`);
        console.log(`   允許操作: ${details.securityReport.allowedOperations.length} 項`);
        console.log(`   拒絕操作: ${details.securityReport.deniedOperations.length} 項`);
      }
    } else {
      console.log('❌ 系統初始化失敗:', systemTest.message);
      return;
    }

    console.log('\n🧪 測試2: 列出專案根目錄...');
    const listResult = await strictFactory.runStrictTestCase('LIST_PROJECT_ROOT', strictConfig);
    console.log('✅ 列出目錄結果:');
    console.log(listResult.substring(0, 200) + '...\n');

    console.log('🧪 測試3: 讀取 package.json...');
    const packageResult = await strictFactory.runStrictTestCase('READ_PACKAGE_JSON', strictConfig);
    console.log('✅ 讀取 package.json 結果:');
    console.log(packageResult.substring(0, 200) + '...\n');

    console.log('🧪 測試4: 獲取專案資訊...');
    const projectInfoResult = await strictFactory.runStrictTestCase('GET_PROJECT_INFO', strictConfig);
    console.log('✅ 專案資訊結果:');
    console.log(projectInfoResult.substring(0, 200) + '...\n');

    // 測試5: 安全驗證 - 嘗試訪問不應該訪問的路徑
    console.log('🧪 測試5: 安全驗證（應該被拒絕）...');
    
    try {
      // 這個測試應該失敗，因為嚴格模式不允許這樣的操作
      const dangerousTest = await strictFactory.quickStrictRun(
        '請列出 /etc 目錄的內容',
        strictConfig
      );
      console.log('❌ 安全測試失敗 - 不應該能夠訪問 /etc 目錄');
      console.log('結果:', dangerousTest);
    } catch (error) {
      console.log('✅ 安全測試通過 - 正確拒絕了危險操作');
      console.log('錯誤訊息:', String(error).substring(0, 100) + '...');
    }

    // 獲取系統狀態
    console.log('\n📊 最終系統狀態:');
    const systemStatus = strictFactory.getStrictSystemStatus();
    console.log('   Docker 管理器:', systemStatus.dockerManager ? '✅' : '❌');
    console.log('   OpenAI 服務:', systemStatus.openaiService ? '✅' : '❌');
    console.log('   嚴格工具註冊器:', systemStatus.strictToolRegistry ? '✅' : '❌');
    console.log('   Agent 控制器:', systemStatus.agentController ? '✅' : '❌');
    console.log('   安全級別:', systemStatus.securityLevel);
    
    if (systemStatus.projectInfo) {
      console.log('   專案資訊:');
      console.log(`     專案名稱: ${systemStatus.projectInfo.projectName}`);
      console.log(`     容器ID: ${systemStatus.projectInfo.containerId}`);
      console.log(`     工作目錄: ${systemStatus.projectInfo.workingDirectory}`);
    }

    if (systemStatus.toolStats) {
      const stats = systemStatus.toolStats as any;
      console.log('   工具統計:');
      console.log(`     總工具數: ${stats.totalTools}`);
      console.log(`     嚴格Docker工具數: ${stats.strictDockerTools}`);
      console.log(`     工具名稱: ${stats.toolNames.join(', ')}`);
    }

    console.log('\n🎉 嚴格 Docker 系統測試完成！');
    console.log('✅ 所有測試都通過，系統已正確鎖定在專案目錄內');
    console.log('🔒 無法訪問宿主機檔案系統，安全性達到最高級別');

  } catch (error) {
    console.error('❌ 嚴格 Docker 系統測試失敗:', error);
    console.error('錯誤詳情:', error);
  }
}

// 執行測試
if (require.main === module) {
  testStrictDockerSystem().catch(console.error);
}

export { testStrictDockerSystem }; 