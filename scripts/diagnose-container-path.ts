#!/usr/bin/env npx tsx

/**
 * 容器路徑診斷工具
 * 用於檢查 Docker 容器內的實際目錄結構
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ContainerInfo {
  id: string;
  name: string;
  status: string;
}

interface DirectoryInfo {
  path: string;
  exists: boolean;
  contents?: string[];
  error?: string;
}

/**
 * 獲取所有容器資訊
 */
async function getAllContainers(): Promise<ContainerInfo[]> {
  try {
    const { stdout } = await execAsync('docker ps -a --format "{{.ID}}\t{{.Names}}\t{{.Status}}"');
    return stdout.trim().split('\n').map(line => {
      const [id, name, status] = line.split('\t');
      return { id, name, status };
    });
  } catch (error) {
    console.error('❌ 無法獲取容器列表:', error);
    return [];
  }
}

/**
 * 檢查容器內的目錄
 */
async function checkDirectoryInContainer(containerId: string, path: string): Promise<DirectoryInfo> {
  try {
    // 檢查目錄是否存在
    const { stdout: lsOutput } = await execAsync(`docker exec ${containerId} ls -la "${path}" 2>/dev/null || echo "DIRECTORY_NOT_FOUND"`);
    
    if (lsOutput.includes('DIRECTORY_NOT_FOUND')) {
      return {
        path,
        exists: false,
        error: '目錄不存在'
      };
    }

    // 獲取目錄內容
    const { stdout: contentsOutput } = await execAsync(`docker exec ${containerId} ls "${path}"`);
    const contents = contentsOutput.trim().split('\n').filter(line => line.length > 0);

    return {
      path,
      exists: true,
      contents
    };
  } catch (error) {
    return {
      path,
      exists: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 主要診斷函數
 */
async function diagnoseContainer(containerId: string): Promise<void> {
  console.log(`\n🔍 診斷容器: ${containerId}`);
  console.log('═'.repeat(60));

  // 獲取容器基本資訊
  try {
    const { stdout: inspectOutput } = await execAsync(`docker inspect ${containerId} --format "{{.Name}}\t{{.State.Status}}\t{{.Config.WorkingDir}}"`);
    const [name, status, workingDir] = inspectOutput.trim().split('\t');
    
    console.log(`📦 容器名稱: ${name}`);
    console.log(`🔄 運行狀態: ${status}`);
    console.log(`📁 預設工作目錄: ${workingDir}`);
  } catch (error) {
    console.error(`❌ 無法獲取容器 ${containerId} 的資訊:`, error);
    return;
  }

  // 檢查常見的目錄路徑
  const pathsToCheck = [
    '/app',
    '/app/workspace',
    '/app/workspace/new-testing',
    '/app/workspace/new_testing',
    '/app/workspace/new-test',
    '/app/workspace/new_test'
  ];

  console.log('\n📂 檢查目錄結構:');
  console.log('─'.repeat(40));

  for (const path of pathsToCheck) {
    const result = await checkDirectoryInContainer(containerId, path);
    
    if (result.exists) {
      console.log(`✅ ${path}`);
      if (result.contents && result.contents.length > 0) {
        console.log(`   內容 (${result.contents.length} 項): ${result.contents.slice(0, 5).join(', ')}${result.contents.length > 5 ? '...' : ''}`);
      } else {
        console.log('   內容: (空目錄)');
      }
    } else {
      console.log(`❌ ${path} - ${result.error}`);
    }
  }

  // 特別檢查 /app/workspace 下的所有子目錄
  console.log('\n🔍 /app/workspace 下的所有子目錄:');
  console.log('─'.repeat(40));
  
  const workspaceResult = await checkDirectoryInContainer(containerId, '/app/workspace');
  if (workspaceResult.exists && workspaceResult.contents) {
    for (const subDir of workspaceResult.contents) {
      if (subDir !== '.' && subDir !== '..') {
        const subDirPath = `/app/workspace/${subDir}`;
        const subDirResult = await checkDirectoryInContainer(containerId, subDirPath);
        
        if (subDirResult.exists) {
          console.log(`📁 ${subDirPath}`);
          
          // 檢查是否包含 package.json
          try {
            await execAsync(`docker exec ${containerId} test -f "${subDirPath}/package.json"`);
            console.log(`   ✅ 包含 package.json`);
          } catch {
            console.log(`   ❌ 不包含 package.json`);
          }
          
          if (subDirResult.contents && subDirResult.contents.length > 0) {
            console.log(`   內容: ${subDirResult.contents.slice(0, 3).join(', ')}${subDirResult.contents.length > 3 ? '...' : ''}`);
          }
        }
      }
    }
  } else {
    console.log('❌ 無法訪問 /app/workspace 目錄');
  }
}

/**
 * 主函數
 */
async function main(): Promise<void> {
  console.log('🐳 Docker 容器路徑診斷工具');
  console.log('═'.repeat(60));

  const containers = await getAllContainers();
  
  if (containers.length === 0) {
    console.log('❌ 未找到任何 Docker 容器');
    return;
  }

  console.log(`📋 找到 ${containers.length} 個容器:`);
  containers.forEach((container, index) => {
    console.log(`${index + 1}. ${container.name} (${container.id}) - ${container.status}`);
  });

  // 診斷所有包含 'ai-web-ide' 的容器
  const aiContainers = containers.filter(c => c.name.includes('ai-web-ide'));
  
  if (aiContainers.length === 0) {
    console.log('⚠️ 未找到 ai-web-ide 相關容器');
    return;
  }

  for (const container of aiContainers) {
    await diagnoseContainer(container.id);
  }

  console.log('\n🎯 診斷總結:');
  console.log('═'.repeat(60));
  console.log('1. 檢查上述輸出中哪些目錄實際存在');
  console.log('2. 確認專案檔案的實際位置');
  console.log('3. 注意專案名稱的格式（短橫線 vs 底線）');
  console.log('4. 確認 package.json 的具體位置');
}

// 執行診斷
main().catch(console.error); 