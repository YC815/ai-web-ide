/**
 * Diff 工具 - 處理純 diff 格式的內容並應用到檔案
 */

import { 
  FunctionDefinition, 
  ToolCategory, 
  FunctionAccessLevel 
} from '../types';
import { DockerContext } from '../../docker/types';
import { executeDockerCommand } from '../../docker/tools';
import fs from 'fs/promises';
import path from 'path';

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
  let resultLines = [...originalLines];
  let offset = 0; // 追蹤行號偏移

  // 按順序應用每個 hunk
  for (const hunk of parsedDiff.hunks) {
    const targetStart = hunk.oldStart - 1 + offset; // 轉換為 0-based index
    let currentPos = targetStart;
    let addedLines: string[] = [];
    let removedCount = 0;

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
            removedCount++;
            offset--;
          } else {
            return {
              success: false,
              error: `Diff 應用失敗：第 ${currentPos + 1} 行移除內容不匹配\n期望移除: "${diffLine.content}"\n實際: "${resultLines[currentPos] || '<EOF>'}"`
            };
          }
          break;

        case 'add':
          // 添加行
          addedLines.push(diffLine.content);
          break;
      }
    }

    // 插入所有添加的行
    if (addedLines.length > 0) {
      resultLines.splice(currentPos, 0, ...addedLines);
      offset += addedLines.length;
    }
  }

  return {
    success: true,
    content: resultLines.join('\n')
  };
}

/**
 * 在 Docker 容器中應用 diff
 */
async function applyDiffInDocker(
  dockerContext: DockerContext,
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
    const readResult = await executeDockerCommand(dockerContext, ['cat', filePath]);
    if (!readResult.success) {
      return {
        success: false,
        message: `無法讀取檔案 ${filePath}`,
        error: readResult.error
      };
    }

    // 3. 應用 diff
    const applyResult = applyDiffToContent(readResult.stdout, parsedDiff);
    if (!applyResult.success) {
      return {
        success: false,
        message: 'Diff 應用失敗',
        error: applyResult.error
      };
    }

    // 4. 寫入修改後的內容
    const tempFile = `/tmp/diff_apply_${Date.now()}.tmp`;
    
    // 創建臨時檔案
    const writeResult = await executeDockerCommand(dockerContext, [
      'sh', '-c', `cat > ${tempFile} << 'EOF'\n${applyResult.content}\nEOF`
    ]);
    
    if (!writeResult.success) {
      return {
        success: false,
        message: '無法創建臨時檔案',
        error: writeResult.error
      };
    }

    // 移動臨時檔案到目標位置
    const moveResult = await executeDockerCommand(dockerContext, ['mv', tempFile, filePath]);
    if (!moveResult.success) {
      // 清理臨時檔案
      await executeDockerCommand(dockerContext, ['rm', '-f', tempFile]);
      return {
        success: false,
        message: `無法寫入檔案 ${filePath}`,
        error: moveResult.error
      };
    }

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
 * Docker Diff 應用工具
 */
export const dockerApplyDiffTool: FunctionDefinition = {
  id: 'docker_apply_diff',
  schema: {
    name: 'docker_apply_diff',
    description: `在 Docker 容器中應用 diff 格式的檔案修改。

    這個工具專門處理標準的 unified diff 格式，包含：
    - 解析和驗證 diff 格式
    - 自動應用修改到指定檔案
    - 詳細的錯誤報告和重試建議

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
  handler: async (params: any, context: any) => {
    const { filePath, diffContent } = params;
    const dockerContext = context?.dockerContext as DockerContext;

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

    const result = await applyDiffInDocker(dockerContext, filePath, diffContent);
    
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
 * 本地 Diff 應用工具
 */
export const localApplyDiffTool: FunctionDefinition = {
  id: 'local_apply_diff',
  schema: {
    name: 'local_apply_diff',
    description: `在本地檔案系統中應用 diff 格式的檔案修改。

    功能與 docker_apply_diff 相同，但操作本地檔案。
    適用於直接修改專案根目錄中的檔案。`,
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '要修改的檔案路徑（相對於專案根目錄）'
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
    category: ToolCategory.FILESYSTEM,
    accessLevel: FunctionAccessLevel.PUBLIC,
    version: '1.0.0',
    author: 'AI Creator Team',
    tags: ['filesystem', 'diff', 'file', 'patch'],
    rateLimited: false
  },
  handler: async (params: any, context: any) => {
    const { filePath, diffContent } = params;

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

    // 確保路徑安全（防止路徑遍歷攻擊）
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.includes('..')) {
      return {
        success: false,
        error: '檔案路徑包含非法字符'
      };
    }

    const result = await applyDiffLocally(normalizedPath, diffContent);
    
    if (result.success) {
      return {
        success: true,
        data: {
          message: result.message,
          filePath: normalizedPath
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
  handler: async (params: any) => {
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

// 導出所有工具
export const diffTools = [
  dockerApplyDiffTool,
  localApplyDiffTool,
  validateDiffTool
];

export default diffTools; 