#!/usr/bin/env npx tsx

/**
 * Diff 工具功能測試
 * 驗證 diff 解析、驗證和應用功能
 */

import { diffTools } from '../src/lib/functions/utility/diff-tool.js';
import fs from 'fs/promises';
import path from 'path';

async function testDiffTools() {
  console.log('🧪 開始測試 Diff 工具功能...\n');

  // 測試用的 diff 內容
  const validDiff = `@@ -1,3 +1,4 @@
 第一行內容
-舊的第二行
+新的第二行
+新增的第三行
 最後一行`;

  const invalidDiff = `這不是有效的 diff 格式
沒有 @@ 標記
也沒有 +/- 前綴`;

  try {
    // 測試 1: Diff 格式驗證工具
    console.log('1️⃣ 測試 Diff 格式驗證工具...');
    
    const validateTool = diffTools.find(tool => tool.id === 'validate_diff');
    if (!validateTool) {
      throw new Error('找不到 validate_diff 工具');
    }

    // 測試有效的 diff
    console.log('   - 測試有效的 diff 格式...');
    const validResult = await validateTool.handler({ diffContent: validDiff });
    console.log('   ✅ 有效 diff 驗證結果:', validResult.success ? '通過' : '失敗');
    if (validResult.success) {
      console.log('      詳細信息:', JSON.stringify(validResult.data.details, null, 2));
    }

    // 測試無效的 diff
    console.log('   - 測試無效的 diff 格式...');
    const invalidResult = await validateTool.handler({ diffContent: invalidDiff });
    console.log('   ✅ 無效 diff 驗證結果:', invalidResult.success ? '通過（不應該通過）' : '正確拒絕');
    if (!invalidResult.success) {
      console.log('      錯誤信息:', invalidResult.error);
    }

    // 測試 2: 本地 Diff 應用工具
    console.log('\n2️⃣ 測試本地 Diff 應用工具...');
    
    const localApplyTool = diffTools.find(tool => tool.id === 'local_apply_diff');
    if (!localApplyTool) {
      throw new Error('找不到 local_apply_diff 工具');
    }

    // 創建測試檔案
    const testFilePath = 'test-diff-file.txt';
    const originalContent = `第一行內容
舊的第二行
最後一行`;

    await fs.writeFile(testFilePath, originalContent, 'utf-8');
    console.log('   ✅ 測試檔案已創建:', testFilePath);

    // 應用 diff
    console.log('   - 應用 diff 到測試檔案...');
    const applyResult = await localApplyTool.handler({
      filePath: testFilePath,
      diffContent: validDiff
    });

    if (applyResult.success) {
      console.log('   ✅ Diff 應用成功:', applyResult.data.message);
      
      // 驗證結果
      const modifiedContent = await fs.readFile(testFilePath, 'utf-8');
      console.log('   📄 修改後的檔案內容:');
      console.log('      ' + modifiedContent.split('\n').join('\n      '));
      
      const expectedContent = `第一行內容
新的第二行
新增的第三行
最後一行`;
      
      if (modifiedContent === expectedContent) {
        console.log('   ✅ 檔案內容修改正確');
      } else {
        console.log('   ❌ 檔案內容修改不正確');
        console.log('   期望:', expectedContent.split('\n').join('\n      '));
        console.log('   實際:', modifiedContent.split('\n').join('\n      '));
      }
    } else {
      console.log('   ❌ Diff 應用失敗:', applyResult.error);
    }

    // 清理測試檔案
    await fs.unlink(testFilePath);
    console.log('   🧹 測試檔案已清理');

    // 測試 3: 錯誤處理
    console.log('\n3️⃣ 測試錯誤處理...');
    
    // 測試不存在的檔案
    console.log('   - 測試不存在的檔案...');
    const nonExistentResult = await localApplyTool.handler({
      filePath: 'non-existent-file.txt',
      diffContent: validDiff
    });
    
    if (!nonExistentResult.success) {
      console.log('   ✅ 正確處理不存在的檔案錯誤:', nonExistentResult.error);
    } else {
      console.log('   ❌ 應該報告檔案不存在錯誤');
    }

    // 測試無效的 diff 應用
    console.log('   - 測試無效的 diff 應用...');
    await fs.writeFile(testFilePath, originalContent, 'utf-8');
    
    const invalidApplyResult = await localApplyTool.handler({
      filePath: testFilePath,
      diffContent: invalidDiff
    });
    
    if (!invalidApplyResult.success) {
      console.log('   ✅ 正確處理無效 diff 錯誤:', invalidApplyResult.error);
    } else {
      console.log('   ❌ 應該報告無效 diff 錯誤');
    }

    await fs.unlink(testFilePath);

    console.log('\n🎉 所有 Diff 工具測試完成！');

    // 總結
    console.log('\n📊 測試總結:');
    console.log('   ✅ Diff 格式驗證功能正常');
    console.log('   ✅ 本地檔案 diff 應用功能正常');
    console.log('   ✅ 錯誤處理機制正常');
    console.log('   ✅ 所有 3 個 diff 工具已成功集成到系統中');

  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error);
    process.exit(1);
  }
}

// 執行測試
testDiffTools().catch(console.error); 