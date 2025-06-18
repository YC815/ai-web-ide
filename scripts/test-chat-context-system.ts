#!/usr/bin/env tsx
// 測試聊天上下文系統
// 驗證 SQLite 儲存、上下文管理和 API 整合是否正常工作

import { chatStorage } from '../src/lib/database/chat-storage';
import { chatContextManager } from '../src/lib/chat/chat-context-manager';

async function testChatContextSystem() {
  console.log('🧪 開始測試聊天上下文系統...\n');

  try {
    // 1. 測試 SQLite 儲存
    console.log('📦 測試 SQLite 儲存...');
    
    const testRoom = chatStorage.createChatRoom({
      id: 'test-room-1',
      title: '測試聊天室',
      projectId: 'test-project',
      projectName: 'Test Project',
      containerId: 'test-container',
      isActive: true,
      totalMessages: 0,
      totalTokens: 0,
      totalCost: 0,
    });
    
    console.log('✅ 聊天室創建成功:', testRoom.id);

    // 2. 測試訊息儲存
    console.log('\n💬 測試訊息儲存...');
    
    const userMessage = await chatContextManager.addUserMessage(
      testRoom.id,
      '你好！請講一個故事講到一半。'
    );
    
    console.log('✅ 用戶訊息儲存成功:', userMessage.id);

    const assistantMessage = await chatContextManager.addAssistantMessage(
      testRoom.id,
      {
        message: '在一個遙遠的村莊裡，住著一位名叫艾莉的小女孩...',
        messageId: 'test-assistant-msg-1',
        tokens: 150,
        cost: 0.001,
        toolCallsExecuted: 0,
      }
    );
    
    console.log('✅ AI 回應儲存成功:', assistantMessage.id);

    // 3. 測試上下文構建
    console.log('\n🧠 測試上下文構建...');
    
    const contextString = await chatContextManager.buildContextString(testRoom.id, 5);
    console.log('✅ 上下文構建成功，長度:', contextString.length);
    console.log('上下文內容預覽:', contextString.substring(0, 200) + '...');

    // 4. 測試專案上下文設置
    console.log('\n🔧 測試專案上下文設置...');
    
    await chatContextManager.setProjectContext(
      testRoom.id,
      'project_tech_stack',
      'Next.js, TypeScript, SQLite',
      24
    );
    
    const techStack = await chatContextManager.getProjectContext(
      testRoom.id,
      'project_tech_stack'
    );
    
    console.log('✅ 專案上下文設置成功:', techStack);

    // 5. 測試聊天歷史獲取
    console.log('\n📚 測試聊天歷史獲取...');
    
    const chatHistory = await chatContextManager.getChatHistory(testRoom.id, 10);
    console.log('✅ 聊天歷史獲取成功，訊息數量:', chatHistory.length);

    // 6. 測試工具使用記錄
    console.log('\n🛠️ 測試工具使用記錄...');
    
    await chatContextManager.recordToolUsage(
      testRoom.id,
      'test_tool',
      { input: 'test input' },
      { output: 'test output' },
      true
    );
    
    console.log('✅ 工具使用記錄成功');

    // 7. 測試聊天統計
    console.log('\n📊 測試聊天統計...');
    
    const stats = await chatContextManager.getChatStats('test-project');
    console.log('✅ 聊天統計獲取成功:', stats);

    // 8. 測試 SQLite 統計
    console.log('\n🗄️ 測試 SQLite 統計...');
    
    const storageStats = chatStorage.getStorageStats();
    console.log('✅ SQLite 統計獲取成功:', storageStats);

    // 9. 模擬上下文對話
    console.log('\n🎭 模擬上下文對話...');
    
    // 添加第二個用戶訊息
    const userMessage2 = await chatContextManager.addUserMessage(
      testRoom.id,
      '繼續講故事'
    );
    
    // 構建包含上下文的完整訊息
    const fullContext = await chatContextManager.buildContextString(testRoom.id, 10);
    console.log('\n📝 完整上下文內容:');
    console.log('='.repeat(50));
    console.log(fullContext);
    console.log('='.repeat(50));

    // 10. 清理測試資料
    console.log('\n🧹 清理測試資料...');
    
    const deleted = await chatContextManager.deleteChatRoom(testRoom.id);
    console.log('✅ 測試聊天室清理成功:', deleted);

    console.log('\n🎉 所有測試通過！聊天上下文系統運行正常。');

  } catch (error) {
    console.error('❌ 測試失敗:', error);
    process.exit(1);
  }
}

// 運行測試
if (require.main === module) {
  testChatContextSystem()
    .then(() => {
      console.log('\n✅ 測試完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 測試執行失敗:', error);
      process.exit(1);
    });
} 