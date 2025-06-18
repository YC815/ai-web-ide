/**
 * Diff 工具 - 處理純 diff 格式的內容並應用到檔案
 * 增強版：包含嚴格的 Docker 安全控管
 */

import { 
  FunctionDefinition, 
  ToolCategory, 
  FunctionAccessLevel 
} from '../types';
import { DockerContext, createDockerToolkit } from '../../docker/tools';
import fs from 'fs/promises';
import path from 'path';

/**
 * Docker 安全配置
 */
interface DockerSecurityConfig {
  allowedContainers: string[];
  restrictedPaths: string[];
  allowedWorkingDirs: string[];
  requireDockerContext: boolean;
}

/**
 * 預設 Docker 安全配置
 */
const DEFAULT_DOCKER_SECURITY: DockerSecurityConfig = {
  allowedContainers: [
    // 允許的容器名稱模式
    'ai-web-ide-*',
    'ai-dev-*'
  ],
  restrictedPaths: [
    // 禁止訪問的路徑
    '/etc',
    '/usr',
    '/bin',
    '/sbin',
    '/root',
    '/home',
    '/var/log',
    '/sys',
    '/proc'
  ],
  allowedWorkingDirs: [
    // 允許的工作目錄
    '/app',
    '/app/workspace',
    '/workspace'
  ],
  requireDockerContext: true
};

/**
 * Diff 行類型
 */
interface DiffLine {
  type: 'context' | 'add' | 'remove' | 'header' | 'invalid';
  content: string;
  lineNumber?: number;
}

/**
 * Diff 區塊
 */
interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

/**
 * 解析後的 Diff
 */
interface ParsedDiff {
  isValid: boolean;
  error?: string;
  oldFile?: string;
  newFile?: string;
  hunks: DiffHunk[];
}

/**
 * 工具參數類型
 */
interface ToolParams {
  filePath: string;
  diffContent: string;
}

/**
 * 工具上下文類型
 */
interface ToolContext {
  dockerContext?: DockerContext;
}

/**
 * 解析 diff 格式內容
 */
function parseDiff(diffContent: string): ParsedDiff {
  const lines = diffContent.split('\n');
  const result: ParsedDiff = {
    isValid: false,
    hunks: []
  };

  let currentHunk: DiffHunk | null = null;
  let inHunk = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 檢查是否為檔案頭部 (--- 和 +++)
    if (line.startsWith('--- ')) {
      result.oldFile = line.substring(4).trim();
      continue;
    }
    
    if (line.startsWith('+++ ')) {
      result.newFile = line.substring(4).trim();
      continue;
    }

    // 檢查是否為 hunk 頭部 (@@)
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      // 保存前一個 hunk
      if (currentHunk) {
        result.hunks.push(currentHunk);
      }

      // 創建新的 hunk
      currentHunk = {
        oldStart: parseInt(hunkMatch[1]),
        oldCount: parseInt(hunkMatch[2] || '1'),
        newStart: parseInt(hunkMatch[3]),
        newCount: parseInt(hunkMatch[4] || '1'),
        lines: []
      };
      inHunk = true;
      continue;
    }

    // 處理 hunk 內容
    if (inHunk && currentHunk) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({
          type: 'add',
          content: line.substring(1)
        });
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({
          type: 'remove',
          content: line.substring(1)
        });
      } else if (line.startsWith(' ')) {
        currentHunk.lines.push({
          type: 'context',
          content: line.substring(1)
        });
      } else if (line.trim() === '') {
        // 空行視為上下文
        currentHunk.lines.push({
          type: 'context',
          content: ''
        });
      }
    }
  }

  // 保存最後一個 hunk
  if (currentHunk) {
    result.hunks.push(currentHunk);
  }

  // 驗證 diff 格式
  if (result.hunks.length === 0) {
    result.error = '無效的 diff 格式：未找到任何 diff hunk (@@...@@)';
    return result;
  }

  // 檢查每個 hunk 的完整性
  for (const hunk of result.hunks) {
    if (hunk.lines.length === 0) {
      result.error = '無效的 diff 格式：發現空的 diff hunk';
      return result;
    }
  }

  result.isValid = true;
  return result;
}

/**
 * 應用 diff 到檔案內容
 */
function applyDiffToContent(originalContent: string, parsedDiff: ParsedDiff): { success: boolean; content?: string; error?: string } {
  if (!parsedDiff.isValid) {
    return { success: false, error: parsedDiff.error };
  }

  const originalLines = originalContent.split('\n');
  const resultLines = [...originalLines];
  let offset = 0; // 追蹤行號偏移

  // 按順序應用每個 hunk
  for (const hunk of parsedDiff.hunks) {
    const targetStart = hunk.oldStart - 1 + offset; // 轉換為 0-based index
    let currentPos = targetStart;

    // 處理 hunk 中的每一行
    for (const diffLine of hunk.lines) {
      switch (diffLine.type) {
        case 'context':
          // 上下文行，檢查是否匹配
          if (currentPos < resultLines.length && resultLines[currentPos] === diffLine.content) {
            currentPos++;
          } else {
            return {
              success: false,
              error: `Diff 應用失敗：第 ${currentPos + 1} 行上下文不匹配\n期望: "${diffLine.content}"\n實際: "${resultLines[currentPos] || '<EOF>'}"`
            };
          }
          break;

        case 'remove':
          // 移除行，檢查是否匹配
          if (currentPos < resultLines.length && resultLines[currentPos] === diffLine.content) {
            resultLines.splice(currentPos, 1);
            offset--;
            // 注意：移除行後不增加 currentPos，因為下一行已經移到當前位置
          } else {
            return {
              success: false,
              error: `Diff 應用失敗：第 ${currentPos + 1} 行移除內容不匹配\n期望移除: "${diffLine.content}"\n實際: "${resultLines[currentPos] || '<EOF>'}"`
            };
          }
          break;

        case 'add':
          // 添加行，立即插入到當前位置
          resultLines.splice(currentPos, 0, diffLine.content);
          currentPos++; // 移動到下一個位置
          offset++; // 增加偏移量
          break;
      }
    }
  }

  return {
    success: true,
    content: resultLines.join('\n')
  };
}

/**
 * 驗證 Docker 環境安全性
 */
function validateDockerSecurity(
  dockerContext: DockerContext,
  filePath: string,
  securityConfig: DockerSecurityConfig = DEFAULT_DOCKER_SECURITY
): { isValid: boolean; error?: string } {
  // 1. 檢查是否有 Docker 上下文
  if (securityConfig.requireDockerContext && !dockerContext) {
    return {
      isValid: false,
      error: '操作被拒絕：缺少 Docker 上下文配置'
    };
  }

  // 2. 檢查容器名稱是否在允許清單中
  if (dockerContext.containerName) {
    const isAllowedContainer = securityConfig.allowedContainers.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(dockerContext.containerName!);
      }
      return dockerContext.containerName === pattern;
    });

    if (!isAllowedContainer) {
      return {
        isValid: false,
        error: `操作被拒絕：容器 ${dockerContext.containerName} 不在允許清單中`
      };
    }
  }

  // 3. 檢查工作目錄是否安全
  if (dockerContext.workingDirectory) {
    const isAllowedWorkingDir = securityConfig.allowedWorkingDirs.some(allowedDir => 
      dockerContext.workingDirectory!.startsWith(allowedDir)
    );

    if (!isAllowedWorkingDir) {
      return {
        isValid: false,
        error: `操作被拒絕：工作目錄 ${dockerContext.workingDirectory} 不在允許清單中`
      };
    }
  }

  // 4. 檢查檔案路徑是否安全
  const normalizedPath = path.normalize(filePath);
  
  // 禁止路徑遍歷
  if (normalizedPath.includes('..')) {
    return {
      isValid: false,
      error: '操作被拒絕：檔案路徑包含非法的路徑遍歷字符'
    };
  }

  // 檢查是否訪問受限制的系統路徑
  const absolutePath = path.isAbsolute(normalizedPath) ? normalizedPath : 
    path.join(dockerContext.workingDirectory || '/app', normalizedPath);

  const isRestrictedPath = securityConfig.restrictedPaths.some(restrictedPath => 
    absolutePath.startsWith(restrictedPath)
  );

  if (isRestrictedPath) {
    return {
      isValid: false,
      error: `操作被拒絕：嘗試訪問受限制的系統路徑 ${absolutePath}`
    };
  }

  // 5. 確保路徑在允許的工作目錄範圍內
  const isInAllowedDir = securityConfig.allowedWorkingDirs.some(allowedDir => 
    absolutePath.startsWith(allowedDir)
  );

  if (!isInAllowedDir) {
    return {
      isValid: false,
      error: `操作被拒絕：檔案路徑 ${absolutePath} 不在允許的工作目錄範圍內`
    };
  }

  return { isValid: true };
}

/**
 * 記錄安全事件
 */
function logSecurityEvent(
  event: 'access_denied' | 'access_granted',
  details: {
    containerName?: string;
    filePath: string;
    reason?: string;
    timestamp: string;
  }
): void {
  const logEntry = {
    type: 'SECURITY_EVENT',
    event,
    ...details
  };
  
  // 在生產環境中，這裡應該寫入安全日誌
  console.warn('[SECURITY]', JSON.stringify(logEntry, null, 2));
}

/**
 * 在 Docker 容器中應用 diff（增強安全版）
 */
async function applyDiffInDockerSecure(
  dockerContext: DockerContext,
  filePath: string,
  diffContent: string
): Promise<{ success: boolean; message: string; error?: string }> {
  const timestamp = new Date().toISOString();
  
  try {
    // 1. 安全性驗證
    const securityCheck = validateDockerSecurity(dockerContext, filePath);
    if (!securityCheck.isValid) {
      logSecurityEvent('access_denied', {
        containerName: dockerContext.containerName,
        filePath,
        reason: securityCheck.error,
        timestamp
      });
      
      return {
        success: false,
        message: '安全檢查失敗',
        error: securityCheck.error
      };
    }

    // 記錄允許的訪問
    logSecurityEvent('access_granted', {
      containerName: dockerContext.containerName,
      filePath,
      timestamp
    });

    // 2. 解析 diff
    const parsedDiff = parseDiff(diffContent);
    if (!parsedDiff.isValid) {
      return {
        success: false,
        message: 'Diff 格式解析失敗',
        error: parsedDiff.error
      };
    }

    // 3. 創建 Docker 工具實例
    const dockerToolkit = createDockerToolkit(dockerContext);

    // 4. 讀取原始檔案內容
    const readResult = await dockerToolkit.fileSystem.readFile(filePath);
    if (!readResult.success || !readResult.data) {
      return {
        success: false,
        message: `無法讀取檔案 ${filePath}`,
        error: readResult.error
      };
    }

    // 5. 應用 diff
    const applyResult = applyDiffToContent(readResult.data, parsedDiff);
    if (!applyResult.success) {
      return {
        success: false,
        message: 'Diff 應用失敗',
        error: applyResult.error
      };
    }

    // 6. 寫入修改後的內容
    const writeResult = await dockerToolkit.fileSystem.writeFile(filePath, applyResult.content!);
    if (!writeResult.success) {
      return {
        success: false,
        message: `無法寫入檔案 ${filePath}`,
        error: writeResult.error
      };
    }

    return {
      success: true,
      message: `成功應用 diff 到 ${filePath} (容器: ${dockerContext.containerName})`
    };

  } catch (error) {
    logSecurityEvent('access_denied', {
      containerName: dockerContext.containerName,
      filePath,
      reason: error instanceof Error ? error.message : String(error),
      timestamp
    });

    return {
      success: false,
      message: 'Diff 應用過程中發生錯誤',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 在本地檔案系統中應用 diff
 */
async function applyDiffLocally(
  filePath: string,
  diffContent: string
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    // 1. 解析 diff
    const parsedDiff = parseDiff(diffContent);
    if (!parsedDiff.isValid) {
      return {
        success: false,
        message: 'Diff 格式解析失敗',
        error: parsedDiff.error
      };
    }

    // 2. 讀取原始檔案內容
    const originalContent = await fs.readFile(filePath, 'utf-8');

    // 3. 應用 diff
    const applyResult = applyDiffToContent(originalContent, parsedDiff);
    if (!applyResult.success) {
      return {
        success: false,
        message: 'Diff 應用失敗',
        error: applyResult.error
      };
    }

    // 4. 寫入修改後的內容
    await fs.writeFile(filePath, applyResult.content!, 'utf-8');

    return {
      success: true,
      message: `成功應用 diff 到 ${filePath}`
    };

  } catch (error) {
    return {
      success: false,
      message: 'Diff 應用過程中發生錯誤',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Docker Diff 應用工具（增強安全版）
 */
export const dockerApplyDiffTool: FunctionDefinition = {
  id: 'docker_apply_diff',
  schema: {
    name: 'docker_apply_diff',
    description: `🔒 在 Docker 容器中安全地應用 diff 格式的檔案修改。

    這個工具專門處理標準的 unified diff 格式，包含：
    - 解析和驗證 diff 格式
    - 自動應用修改到指定檔案
    - 詳細的錯誤報告和重試建議
    - 🛡️ 嚴格的安全控管機制

    🔒 安全控管功能：
    - 僅允許在指定的 Docker 容器中執行
    - 限制檔案操作在允許的工作目錄內
    - 防止路徑遍歷攻擊
    - 禁止訪問系統敏感路徑
    - 完整的安全事件記錄

    Diff 格式要求：
    1. 必須包含 hunk 標記 (@@...@@)
    2. 使用標準的 +/- 前綴表示增加/刪除
    3. 使用空格前綴表示上下文行

    範例 diff 格式：
    \`\`\`
    @@ -1,3 +1,4 @@
     第一行
    -舊的第二行
    +新的第二行
    +新增的第三行
     第三行
    \`\`\``,
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '要修改的檔案路徑（相對於容器工作目錄）'
        },
        diffContent: {
          type: 'string',
          description: '標準 unified diff 格式的內容'
        }
      },
      required: ['filePath', 'diffContent']
    }
  },
  metadata: {
    category: ToolCategory.DOCKER,
    accessLevel: FunctionAccessLevel.PUBLIC,
    version: '1.0.0',
    author: 'AI Creator Team',
    tags: ['docker', 'diff', 'file', 'patch'],
    rateLimited: false
  },
  handler: async (params: ToolParams, context: ToolContext) => {
    const { filePath, diffContent } = params;
    const dockerContext = context?.dockerContext;

    if (!dockerContext) {
      return {
        success: false,
        error: 'Docker 上下文未配置'
      };
    }

    if (!filePath || typeof filePath !== 'string') {
      return {
        success: false,
        error: '檔案路徑參數無效'
      };
    }

    if (!diffContent || typeof diffContent !== 'string') {
      return {
        success: false,
        error: 'Diff 內容參數無效'
      };
    }

    const result = await applyDiffInDockerSecure(dockerContext, filePath, diffContent);
    
    if (result.success) {
      return {
        success: true,
        data: {
          message: result.message,
          filePath: filePath
        }
      };
    } else {
      return {
        success: false,
        error: result.error || result.message,
        data: {
          suggestion: 'Please check the diff format and ensure it follows unified diff standard. Make sure the file exists and the context lines match exactly.'
        }
      };
    }
  }
};

/**
 * 本地 Diff 應用工具（已禁用 - 安全限制）
 */
export const localApplyDiffTool: FunctionDefinition = {
  id: 'local_apply_diff_disabled',
  schema: {
    name: 'local_apply_diff_disabled',
    description: `⚠️ 此工具已被禁用以確保安全性。
    
    為了防止意外修改宿主機檔案，本地 diff 工具已被停用。
    請使用 docker_apply_diff 在 Docker 容器環境中安全地應用檔案修改。`,
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '檔案路徑（工具已禁用）'
        },
        diffContent: {
          type: 'string',
          description: 'Diff 內容（工具已禁用）'
        }
      },
      required: ['filePath', 'diffContent']
    }
  },
  metadata: {
    category: ToolCategory.FILESYSTEM,
    accessLevel: FunctionAccessLevel.RESTRICTED,
    version: '2.0.0',
    author: 'AI Creator Team',
    tags: ['filesystem', 'diff', 'file', 'patch', 'disabled'],
    rateLimited: true
  },
  handler: async (params: ToolParams) => {
    // 記錄嘗試使用已禁用工具的事件
    logSecurityEvent('access_denied', {
      filePath: params.filePath,
      reason: '嘗試使用已禁用的本地 diff 工具',
      timestamp: new Date().toISOString()
    });

    return {
      success: false,
      error: '安全限制：本地 diff 工具已被禁用',
      data: {
        suggestion: '請使用 docker_apply_diff 工具在 Docker 容器環境中安全地應用檔案修改。這確保了操作僅限於指定的容器環境，不會影響宿主機檔案。'
      }
    };
  }
};

/**
 * Diff 驗證工具（僅驗證格式，不應用修改）
 */
export const validateDiffTool: FunctionDefinition = {
  id: 'validate_diff',
  schema: {
    name: 'validate_diff',
    description: `驗證 diff 格式是否正確，但不應用修改。

    用於在應用 diff 之前檢查格式是否正確。
    返回詳細的解析結果和可能的錯誤信息。`,
    parameters: {
      type: 'object',
      properties: {
        diffContent: {
          type: 'string',
          description: '要驗證的 diff 內容'
        }
      },
      required: ['diffContent']
    }
  },
  metadata: {
    category: ToolCategory.UTILITY,
    accessLevel: FunctionAccessLevel.PUBLIC,
    version: '1.0.0',
    author: 'AI Creator Team',
    tags: ['utility', 'diff', 'validation'],
    rateLimited: false
  },
  handler: async (params: { diffContent: string }) => {
    const { diffContent } = params;

    if (!diffContent || typeof diffContent !== 'string') {
      return {
        success: false,
        error: 'Diff 內容參數無效'
      };
    }

    const parsedDiff = parseDiff(diffContent);
    
    if (parsedDiff.isValid) {
      return {
        success: true,
        data: {
          message: 'Diff 格式驗證通過',
          details: {
            hunksCount: parsedDiff.hunks.length,
            oldFile: parsedDiff.oldFile,
            newFile: parsedDiff.newFile,
            hunks: parsedDiff.hunks.map(hunk => ({
              oldStart: hunk.oldStart,
              oldCount: hunk.oldCount,
              newStart: hunk.newStart,
              newCount: hunk.newCount,
              linesCount: hunk.lines.length
            }))
          }
        }
      };
    } else {
      return {
        success: false,
        error: parsedDiff.error,
        data: {
          suggestion: 'Please ensure the diff follows unified diff format with proper @@ hunk headers and +/- line prefixes.'
        }
      };
    }
  }
};

/**
 * Docker 安全配置工具
 */
export const dockerSecurityConfigTool: FunctionDefinition = {
  id: 'docker_security_config',
  schema: {
    name: 'docker_security_config',
    description: `🔒 查看和驗證 Docker 安全配置。

    這個工具允許：
    - 查看當前的安全配置設定
    - 驗證容器和路徑是否符合安全要求
    - 檢查 Docker 上下文配置

    用於確保 diff 工具在安全的環境中運行。`,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['view_config', 'check_container', 'check_path'],
          description: '要執行的操作類型'
        },
        containerName: {
          type: 'string',
          description: '要檢查的容器名稱（當 action 為 check_container 時）'
        },
        filePath: {
          type: 'string',
          description: '要檢查的檔案路徑（當 action 為 check_path 時）'
        }
      },
      required: ['action']
    }
  },
  metadata: {
    category: ToolCategory.DOCKER,
    accessLevel: FunctionAccessLevel.PUBLIC,
    version: '1.0.0',
    author: 'AI Creator Team',
    tags: ['docker', 'security', 'config', 'validation'],
    rateLimited: false
  },
  handler: async (params: { action: string; containerName?: string; filePath?: string }, context: ToolContext) => {
    const { action, containerName, filePath } = params;

    switch (action) {
      case 'view_config':
        return {
          success: true,
          data: {
            message: 'Docker 安全配置',
            config: DEFAULT_DOCKER_SECURITY
          }
        };

      case 'check_container':
        if (!containerName) {
          return {
            success: false,
            error: '檢查容器時需要提供容器名稱'
          };
        }

        const isAllowedContainer = DEFAULT_DOCKER_SECURITY.allowedContainers.some(pattern => {
          if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
            return regex.test(containerName);
          }
          return containerName === pattern;
        });

        return {
          success: true,
          data: {
            containerName,
            isAllowed: isAllowedContainer,
            message: isAllowedContainer 
              ? `容器 ${containerName} 符合安全要求` 
              : `容器 ${containerName} 不在允許清單中`
          }
        };

      case 'check_path':
        if (!filePath || !context?.dockerContext) {
          return {
            success: false,
            error: '檢查路徑時需要提供檔案路徑和 Docker 上下文'
          };
        }

        const securityCheck = validateDockerSecurity(context.dockerContext, filePath);
        return {
          success: true,
          data: {
            filePath,
            isValid: securityCheck.isValid,
            message: securityCheck.isValid 
              ? `路徑 ${filePath} 符合安全要求` 
              : securityCheck.error
          }
        };

      default:
        return {
          success: false,
          error: '不支援的操作類型'
        };
    }
  }
};

// 導出所有工具
export const diffTools = [
  dockerApplyDiffTool,
  localApplyDiffTool, // 已禁用，但保留用於錯誤提示
  validateDiffTool,
  dockerSecurityConfigTool
];

export default diffTools;

// 導出安全配置和函數供其他模組使用
export { DEFAULT_DOCKER_SECURITY, validateDockerSecurity, logSecurityEvent }; 