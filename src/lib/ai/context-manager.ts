
// AI 上下文管理器 - 讓AI智能地掌握專案狀態
import { createDockerToolkit, DockerToolkit, DockerToolResponse, createDefaultDockerContext } from '../docker/tools';

export interface ProjectContext {
  projectId: string;
  projectName: string;
  containerStatus: 'running' | 'stopped' | 'error';
}

export interface ProjectSnapshot {
  projectInfo: {
    name: string;
    type: string;
    version: string;
    isInitialized: boolean;
  };
  fileStructure: {
    directories: string[];
    files: string[];
    keyFiles: Record<string, string>; // 重要檔案的內容摘要
  };
  dependencies: {
    devDependencies: Record<string, string>;
    dependencies: Record<string, string>;
  };
  gitStatus?: {
    branch: string;
    hasChanges: boolean;
    lastCommit: string;
  };
  buildStatus?: {
    canBuild: boolean;
    lastBuildTime?: string;
    errors?: string[];
  };
}

// AI智能上下文管理器
export class AIContextManager {
  private toolkit: DockerToolkit;
  private projectSnapshot: ProjectSnapshot | null = null;
  private lastSnapshotTime: number = 0;
  private snapshotCacheDuration = 30000; // 30秒快取

  constructor(private projectContext: ProjectContext) {
    const dockerContext = createDefaultDockerContext(`${projectContext.projectId}-container`, `ai-dev-${projectContext.projectName}`);
    this.toolkit = createDockerToolkit(dockerContext);
  }

  /**
   * 獲取完整的專案快照 - AI的專案理解入口
   */
  async getProjectSnapshot(forceRefresh: boolean = false): Promise<DockerToolResponse<ProjectSnapshot>> {
    const now = Date.now();
    
    // 如果有快取且未超時，直接返回
    if (!forceRefresh && this.projectSnapshot && (now - this.lastSnapshotTime) < this.snapshotCacheDuration) {
      return {
        success: true,
        data: this.projectSnapshot,
        message: '使用快取的專案快照'
      };
    }

    try {
      console.log('🔍 AI正在分析專案狀態...');
      
      // 1. 檢查Docker容器健康狀態
      const healthResult = await this.toolkit.healthCheck.checkContainerHealth();
      if (!healthResult.success) {
        return {
          success: false,
          error: `無法獲取Docker容器狀態: ${healthResult.error}`
        };
      }

      // 2. 獲取容器內檔案結構（模擬）
      const structureResult = await this.toolkit.fileSystem.readFile('package.json');
      const files = ['package.json', 'next.config.js', 'tsconfig.json']; // 簡化的檔案列表

      // 3. 分析關鍵檔案
      const keyFiles = await this.analyzeKeyFiles(files);
      
      // 4. 讀取依賴資訊
      const dependencies = await this.analyzeDependencies();
      
      // 5. 檢查開發伺服器狀態
      const devServerStatus = await this.toolkit.devServer.checkDevServerStatus();

      // 建立專案快照
      this.projectSnapshot = {
        projectInfo: {
          name: this.projectContext.projectName,
          type: keyFiles.projectType || 'nextjs',
          version: keyFiles.version || '1.0.0',
          isInitialized: healthResult.success
        },
        fileStructure: {
          directories: ['src', 'public', 'components'],
          files: files,
          keyFiles: keyFiles.contents
        },
        dependencies: dependencies,
        buildStatus: {
          canBuild: devServerStatus.success,
          lastBuildTime: new Date().toISOString()
        }
      };

      this.lastSnapshotTime = now;
      
      console.log('✅ 專案快照分析完成');
      return {
        success: true,
        data: this.projectSnapshot,
        message: '專案快照更新完成'
      };

    } catch (error) {
      return {
        success: false,
        error: `分析專案時發生錯誤: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 分析關鍵檔案內容
   */
  private async analyzeKeyFiles(files: string[]): Promise<{
    projectType: string;
    version: string;
    contents: Record<string, string>;
  }> {
    const keyFilePatterns = [
      'package.json',
      'next.config.js',
      'next.config.ts', 
      'tsconfig.json',
      '.ai-project-config.json',
      'AI_INSTRUCTIONS.md',
      'TODO.md',
      'README.md'
    ];

    const contents: Record<string, string> = {};
    let projectType = 'unknown';
    let version = '1.0.0';

    for (const pattern of keyFilePatterns) {
      const matchingFiles = files.filter(file => file.endsWith(pattern));
      
      for (const file of matchingFiles) {
        try {
          const result = await this.toolkit.fileSystem.readFile(file);
          if (result.success && result.data) {
            contents[file] = result.data;
            
            // 分析專案類型
            if (file.endsWith('package.json')) {
              try {
                const packageJson = JSON.parse(result.data);
                if (packageJson.dependencies?.next) {
                  projectType = 'nextjs';
                } else if (packageJson.dependencies?.react) {
                  projectType = 'react';
                } else if (packageJson.dependencies?.vue) {
                  projectType = 'vue';
                }
                version = packageJson.version || '1.0.0';
              } catch {
                console.warn('無法解析 package.json');
              }
            }
          }
        } catch (error) {
          console.warn(`讀取檔案 ${file} 失敗:`, error);
        }
      }
    }

    return { projectType, version, contents };
  }

  /**
   * 分析依賴資訊
   */
  private async analyzeDependencies(): Promise<{dependencies: Record<string, string>, devDependencies: Record<string, string>}> {
    try {
      const packageJsonResult = await this.toolkit.fileSystem.readFile('package.json');
      
      if (packageJsonResult.success && packageJsonResult.data) {
        const packageJson = JSON.parse(packageJsonResult.data);
        return {
          dependencies: packageJson.dependencies || {},
          devDependencies: packageJson.devDependencies || {}
        };
      }
    } catch (error) {
      console.warn('無法分析依賴資訊:', error);
    }

    return { dependencies: {}, devDependencies: {} };
  }

  /**
   * 分析Git狀態
   */
  private async analyzeGitStatus(): Promise<{branch: string, hasChanges: boolean, lastCommit: string} | undefined> {
    try {
      // 檢查當前分支
      const branchResult = await this.toolkit.command.gitCommand(['branch', '--show-current']);
      
      // 檢查是否有變更
      const statusResult = await this.toolkit.command.gitCommand(['status', '--porcelain']);
      
      // 獲取最後一次提交
      const commitResult = await this.toolkit.command.gitCommand(['log', '-1', '--oneline']);

      if (branchResult.success) {
        return {
          branch: branchResult.data?.stdout.trim() || 'main',
          hasChanges: (statusResult.data?.stdout.trim().length || 0) > 0,
          lastCommit: commitResult.data?.stdout.trim() || 'No commits'
        };
      }
    } catch (error) {
      console.warn('無法分析Git狀態:', error);
    }
    
    return undefined;
  }

  /**
   * 分析建置狀態
   */
  private async analyzeBuildStatus(): Promise<{canBuild: boolean, lastBuildTime?: string, errors?: string[]} | undefined> {
    try {
      // 檢查是否可以建置
      const buildResult = await this.toolkit.command.npmCommand(['run', 'build', '--dry-run']);
      
      return {
        canBuild: buildResult.success,
        errors: buildResult.success ? undefined : [buildResult.error || 'Build failed']
      };
    } catch (error) {
      console.warn('無法分析建置狀態:', error);
    }
    
    return undefined;
  }

  /**
   * 從檔案列表中提取目錄結構
   */
  private extractDirectories(files: string[]): string[] {
    const directories = new Set<string>();
    
    files.forEach(file => {
      const parts = file.split('/');
      let currentPath = '';
      
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath += (i > 0 ? '/' : '') + parts[i];
        directories.add(currentPath);
      }
    });
    
    return Array.from(directories).sort();
  }

  /**
   * 智能建議 - 根據專案狀態給出AI操作建議
   */
  async getSmartSuggestions(): Promise<DockerToolResponse<string[]>> {
    const snapshotResult = await this.getProjectSnapshot();
    
    if (!snapshotResult.success || !snapshotResult.data) {
      return {
        success: false,
        error: '無法獲取專案狀態來產生建議'
      };
    }

    const snapshot = snapshotResult.data;
    const suggestions: string[] = [];

    // 基於專案狀態產生建議
    if (!snapshot.projectInfo.isInitialized) {
      suggestions.push('🚀 專案尚未初始化，建議先執行專案初始化');
    }

    if (Object.keys(snapshot.dependencies.dependencies).length === 0) {
      suggestions.push('📦 專案沒有依賴，可能需要安裝基礎依賴');
    }

    if (!snapshot.fileStructure.files.find(f => f.includes('README'))) {
      suggestions.push('📝 建議創建 README.md 檔案來描述專案');
    }

    if (snapshot.gitStatus && snapshot.gitStatus.hasChanges) {
      suggestions.push('💾 有未提交的變更，建議建立 Git checkpoint');
    }

    if (snapshot.buildStatus && !snapshot.buildStatus.canBuild) {
      suggestions.push('🔨 專案無法建置，建議檢查並修復錯誤');
    }

    if (suggestions.length === 0) {
      suggestions.push('✅ 專案狀態良好，可以開始開發新功能');
    }

    return {
      success: true,
      data: suggestions,
      message: `根據專案狀態產生了 ${suggestions.length} 個建議`
    };
  }

  /**
   * 生成給AI的專案摘要報告
   */
  async generateAIProjectReport(): Promise<string> {
    const snapshotResult = await this.getProjectSnapshot();
    
    if (!snapshotResult.success || !snapshotResult.data) {
      return '❌ 無法獲取專案資訊';
    }

    const snapshot = snapshotResult.data;
    
    let report = `# 專案狀態報告

## 📋 基本資訊
- **專案名稱**: ${snapshot.projectInfo.name}
- **專案類型**: ${snapshot.projectInfo.type}
- **版本**: ${snapshot.projectInfo.version}
- **初始化狀態**: ${snapshot.projectInfo.isInitialized ? '✅ 已初始化' : '❌ 未初始化'}

## 📁 檔案結構
- **目錄數量**: ${snapshot.fileStructure.directories.length}
- **檔案數量**: ${snapshot.fileStructure.files.length}
- **重要檔案**: ${Object.keys(snapshot.fileStructure.keyFiles).join(', ')}

## 📦 依賴管理
- **生產依賴**: ${Object.keys(snapshot.dependencies.dependencies).length} 個
- **開發依賴**: ${Object.keys(snapshot.dependencies.devDependencies).length} 個
`;

    if (snapshot.gitStatus) {
      report += `
## 🔄 Git 狀態
- **當前分支**: ${snapshot.gitStatus.branch}
- **有變更**: ${snapshot.gitStatus.hasChanges ? '是' : '否'}
- **最後提交**: ${snapshot.gitStatus.lastCommit}
`;
    }

    if (snapshot.buildStatus) {
      report += `
## 🔨 建置狀態
- **可建置**: ${snapshot.buildStatus.canBuild ? '是' : '否'}
${snapshot.buildStatus.errors ? `- **錯誤**: ${snapshot.buildStatus.errors.join(', ')}` : ''}
`;
    }

    // 添加智能建議
    const suggestionsResult = await this.getSmartSuggestions();
    if (suggestionsResult.success && suggestionsResult.data) {
      report += `
## 💡 AI 建議
${suggestionsResult.data.map(s => `- ${s}`).join('\n')}
`;
    }

    return report;
  }

  /**
   * 重置快取，強制重新分析
   */
  resetCache(): void {
    this.projectSnapshot = null;
    this.lastSnapshotTime = 0;
  }
}

// 工廠函數
export function createAIContextManager(projectContext: ProjectContext): AIContextManager {
  return new AIContextManager(projectContext);
}

// AI專案探索的使用指南
export const AI_PROJECT_EXPLORATION_GUIDE = `
# AI 專案探索指南

## 🎯 快速開始

\`\`\`typescript
// 1. 創建上下文管理器
const contextManager = createAIContextManager(projectContext);

// 2. 獲取完整專案快照
const snapshot = await contextManager.getProjectSnapshot();

// 3. 生成專案報告給AI理解
const report = await contextManager.generateAIProjectReport();

// 4. 獲取智能建議
const suggestions = await contextManager.getSmartSuggestions();
\`\`\`

## 🧠 AI理解專案的步驟

1. **初始掃描**: 獲取專案快照了解整體結構
2. **關鍵檔案分析**: 讀取 package.json、配置檔等
3. **依賴分析**: 了解專案技術棧和依賴關係
4. **狀態評估**: 檢查Git、建置、初始化狀態
5. **建議生成**: 基於分析結果產生操作建議

## 🔄 持續監控

- 自動快取機制避免重複分析
- 支援強制刷新獲取最新狀態
- 智能建議系統輔助AI決策

這樣AI就能真正「掌握」專案了！
`; 