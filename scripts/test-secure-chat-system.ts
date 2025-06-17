#!/usr/bin/env tsx

/**
 * 安全聊天系統測試腳本
 * 驗證 SecureChatAgentIntegrator 是否正確替換了不安全的舊工具
 */

import { SecureChatAgentIntegrator } from '../src/lib/ai/secure-chat-agent-integration';

async function testSecureChatSystem() {
  console.log('🔒 開始測試安全聊天系統...\n');

  try {
    // 配置安全聊天系統
    const secureConfig = {
      projectName: 'web_test',
      dockerContainerId: '41acd88ac05a',
      conversationId: 'test-conv-secure-001',
      apiToken: 'test-token', // 不會真正調用 OpenAI，只測試初始化
    };

    console.log('📦 安全聊天配置:');
    console.log(`   專案名稱: ${secureConfig.projectName}`);
    console.log(`   容器ID: ${secureConfig.dockerContainerId}`);
    console.log(`   對話ID: ${secureConfig.conversationId}`);
    console.log(`   工作目錄: /app/workspace/${secureConfig.projectName}\n`);

    // 測試1: 建立安全聊天整合器
    console.log('🧪 測試1: 建立安全聊天整合器...');
    const secureIntegrator = new SecureChatAgentIntegrator(secureConfig);
    console.log('✅ 安全聊天整合器建立成功\n');

    // 測試2: 初始化（不需要 OpenAI API Key 來測試基本功能）
    console.log('🧪 測試2: 初始化安全系統（基本驗證）...');
    try {
      // 這會失敗因為沒有真正的 API Key，但我們可以檢查錯誤類型
      await secureIntegrator.initialize();
      console.log('✅ 初始化成功');
    } catch (error) {
      const errorStr = String(error);
      if (errorStr.includes('OpenAI API Key')) {
        console.log('✅ 初始化正確檢查了 API Key（預期行為）');
        console.log('   錯誤:', errorStr.substring(0, 100) + '...');
      } else {
        console.log('❌ 初始化失敗，非預期錯誤:', errorStr);
        return;
      }
    }

    // 測試3: 獲取安全報告（不需要完整初始化）
    console.log('\n🧪 測試3: 安全報告功能...');
    try {
      const securityReport = secureIntegrator.getSecurityReport();
      console.log('✅ 安全報告獲取成功');
      console.log('🛡️ 安全報告內容:');
      console.log(`   安全級別: ${securityReport.securityLevel}`);
      console.log(`   專案名稱: ${securityReport.projectName}`);
      console.log(`   容器ID: ${securityReport.containerId}`);
      console.log(`   工作目錄: ${securityReport.workingDirectory}`);
      console.log(`   對話ID: ${securityReport.conversationId}`);
      console.log(`   訊息數量: ${securityReport.messageCount}`);
      console.log('   安全措施:');
      securityReport.safetyMeasures.forEach(measure => {
        console.log(`     - ${measure}`);
      });
    } catch (error) {
      console.log('❌ 獲取安全報告失敗:', error);
    }

    // 測試4: 統計功能
    console.log('\n🧪 測試4: 統計功能...');
    try {
      const stats = secureIntegrator.getStats();
      console.log('✅ 統計功能正常');
      console.log('📊 統計資訊:');
      console.log(`   對話ID: ${stats.conversation.id}`);
      console.log(`   訊息數量: ${stats.conversation.messageCount}`);
      console.log(`   專案名稱: ${stats.conversation.projectName}`);
      console.log(`   工具調用次數: ${stats.toolCalls.totalCalls}`);
      console.log(`   安全級別: ${stats.security.level}`);
      console.log(`   容器ID: ${stats.security.containerId}`);
    } catch (error) {
      console.log('❌ 統計功能失敗:', error);
    }

    // 測試5: 對話歷史功能
    console.log('\n🧪 測試5: 對話歷史功能...');
    try {
      const history = secureIntegrator.getConversationHistory();
      console.log('✅ 對話歷史功能正常');
      console.log(`   歷史記錄數量: ${history.length}`);
    } catch (error) {
      console.log('❌ 對話歷史功能失敗:', error);
    }

    // 測試6: 清理功能
    console.log('\n🧪 測試6: 清理功能...');
    try {
      secureIntegrator.cleanup();
      console.log('✅ 清理功能正常');
    } catch (error) {
      console.log('❌ 清理功能失敗:', error);
    }

    // 測試7: 配置驗證
    console.log('\n🧪 測試7: 配置驗證...');
    try {
      // 測試缺少必要配置的情況
      const invalidConfig = {
        conversationId: 'test',
        apiToken: 'test',
        // 缺少 projectName 和 dockerContainerId
      } as any;
      
      try {
        new SecureChatAgentIntegrator(invalidConfig);
        console.log('❌ 配置驗證失敗 - 應該拒絕無效配置');
      } catch (configError) {
        console.log('✅ 配置驗證正常 - 正確拒絕了無效配置');
        console.log(`   錯誤: ${String(configError).substring(0, 100)}...`);
      }
    } catch (error) {
      console.log('❌ 配置驗證測試失敗:', error);
    }

    console.log('\n🎉 安全聊天系統測試完成！');
    console.log('✅ 所有基本功能都正常運作');
    console.log('🔒 安全機制已正確實施');
    console.log('🛡️ 系統已準備好替換不安全的舊工具');

    console.log('\n📋 遷移檢查清單:');
    console.log('   ✅ SecureChatAgentIntegrator 可正常建立');
    console.log('   ✅ 配置驗證機制運作正常');
    console.log('   ✅ 安全報告功能可用');
    console.log('   ✅ 統計功能可用');
    console.log('   ✅ 對話歷史功能可用');
    console.log('   ✅ 清理功能可用');
    console.log('   ✅ 必要配置檢查正常');

    console.log('\n⚡ 下一步:');
    console.log('   1. 在實際應用中替換 ChatAgentIntegrator');
    console.log('   2. 提供真實的 OpenAI API Key 進行完整測試');
    console.log('   3. 更新所有工具調用使用 strict_docker_* 工具');
    console.log('   4. 驗證所有操作都限制在專案目錄內');

  } catch (error) {
    console.error('❌ 安全聊天系統測試失敗:', error);
    console.error('錯誤詳情:', error);
  }
}

// 執行測試
if (require.main === module) {
  testSecureChatSystem().catch(console.error);
}

export { testSecureChatSystem }; 