#!/usr/bin/env tsx

/**
 * Docker 檔案讀取測試腳本
 * 測試修正後的Docker工具是否能正確讀取容器內的檔案
 */

import { createDockerAIEditorManager, createDefaultDockerContext } from '../src/lib/docker';

async function testDockerFileReading() {
  console.log('🧪 開始測試 Docker 檔案讀取功能...\n');

  try {
    // 使用第一個容器進行測試
    const containerId = '41acd88ac05a';
    const dockerContext = createDefaultDockerContext(containerId);
    
    console.log('📦 Docker 上下文配置:');
    console.log(`   容器ID: ${dockerContext.containerId}`);
    console.log(`   容器名稱: ${dockerContext.containerName}`);
    console.log(`   工作目錄: ${dockerContext.workingDirectory}\n`);

    const dockerManager = createDockerAIEditorManager({
      dockerContext,
      enableUserConfirmation: false,
      enableActionLogging: true,
    });

    // 測試1：列出根目錄
    console.log('📁 測試1：列出工作目錄內容...');
    const listResult = await dockerManager.executeDockerAITool('docker_list_directory', { 
      dirPath: '.' 
    });
    
    if (listResult.success) {
      console.log('✅ 成功列出目錄內容:');
      const items = listResult.data as string[];
      items.slice(0, 10).forEach(item => console.log(`   ${item}`));
      if (items.length > 10) {
        console.log(`   ... 還有 ${items.length - 10} 個項目`);
      }
    } else {
      console.log('❌ 列出目錄失敗:', listResult.error);
    }
    console.log('');

    // 測試2：檢查src目錄是否存在
    console.log('📁 測試2：檢查src目錄...');
    const srcListResult = await dockerManager.executeDockerAITool('docker_list_directory', { 
      dirPath: 'src' 
    });
    
    if (srcListResult.success) {
      console.log('✅ src目錄存在，內容:');
      const items = srcListResult.data as string[];
      items.forEach(item => console.log(`   ${item}`));
    } else {
      console.log('❌ src目錄不存在或無法讀取:', srcListResult.error);
    }
    console.log('');

    // 測試3：嘗試讀取page.tsx檔案
    console.log('📄 測試3：讀取 src/app/page.tsx 檔案...');
    const fileResult = await dockerManager.executeDockerAITool('docker_read_file', { 
      filePath: 'src/app/page.tsx' 
    });
    
    if (fileResult.success) {
      const content = fileResult.data as string;
      console.log('✅ 成功讀取檔案!');
      console.log(`   檔案大小: ${content.length} 字元`);
      console.log('   檔案開頭:');
      console.log(content.substring(0, 200) + (content.length > 200 ? '...' : ''));
    } else {
      console.log('❌ 讀取檔案失敗:', fileResult.error);
    }
    console.log('');

    // 測試4：檢查package.json
    console.log('📄 測試4：讀取 package.json 檔案...');
    const packageResult = await dockerManager.executeDockerAITool('docker_read_file', { 
      filePath: 'package.json' 
    });
    
    if (packageResult.success) {
      const content = packageResult.data as string;
      console.log('✅ 成功讀取 package.json!');
      try {
        const packageData = JSON.parse(content);
        console.log(`   專案名稱: ${packageData.name || 'N/A'}`);
        console.log(`   版本: ${packageData.version || 'N/A'}`);
        console.log(`   框架: ${packageData.dependencies?.next ? 'Next.js' : '未知'}`);
      } catch (e) {
        console.log('   無法解析JSON內容');
      }
    } else {
      console.log('❌ 讀取 package.json 失敗:', packageResult.error);
    }
    console.log('');

    console.log('🎉 Docker 檔案讀取測試完成!');

  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error);
  }
}

// 執行測試
if (require.main === module) {
  testDockerFileReading().catch(console.error);
}

export { testDockerFileReading }; 