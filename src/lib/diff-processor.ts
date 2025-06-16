// Unified Diff 處理工具
// 使用專業的 diff 庫來處理代碼變更

import * as Diff from 'diff';

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  lineNumber?: number;
}

export interface ParsedDiff {
  oldFileName: string;
  newFileName: string;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffStats {
  additions: number;
  deletions: number;
  changes: number;
}

// 🔧 Diff 處理器
export class DiffProcessor {
  /**
   * 生成兩個文本之間的 unified diff
   * @param original 原始文本
   * @param modified 修改後的文本
   * @param fileName 檔案名稱
   * @param context 上下文行數，預設為 3
   */
  static generateUnifiedDiff(
    original: string, 
    modified: string, 
    fileName: string = 'file.txt',
    context: number = 3
  ): string {
    const patch = Diff.createPatch(
      fileName,
      original,
      modified,
      'original',
      'modified',
      { context }
    );
    
    return patch;
  }

  /**
   * 套用 unified diff 到原始文本
   * @param original 原始文本
   * @param patch unified diff 字串
   */
  static applyUnifiedDiff(original: string, patch: string): string {
    try {
      const results = Diff.applyPatch(original, patch);
      
      if (results === false) {
        throw new Error('無法套用 patch，可能是衝突或格式錯誤');
      }
      
      return results;
    } catch (error) {
      throw new Error(`套用 diff 失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 解析 unified diff 字串
   * @param diffText unified diff 字串
   */
  static parseUnifiedDiff(diffText: string): ParsedDiff[] {
    const parsedDiffs = Diff.parsePatch(diffText);
    
    return parsedDiffs.map(diff => ({
      oldFileName: diff.oldFileName || '',
      newFileName: diff.newFileName || '',
      hunks: diff.hunks.map(hunk => ({
        oldStart: hunk.oldStart,
        oldLines: hunk.oldLines,
        newStart: hunk.newStart,
        newLines: hunk.newLines,
        lines: hunk.lines.map(line => ({
          type: line[0] === '+' ? 'add' : line[0] === '-' ? 'remove' : 'context',
          content: line.substring(1),
          lineNumber: undefined // 可以後續計算
        }))
      }))
    }));
  }

  /**
   * 計算 diff 統計資訊
   * @param diffText unified diff 字串
   */
  static calculateDiffStats(diffText: string): DiffStats {
    const lines = diffText.split('\n');
    let additions = 0;
    let deletions = 0;
    
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }
    
    return {
      additions,
      deletions,
      changes: additions + deletions
    };
  }

  /**
   * 生成結構化的 diff 對象
   * @param original 原始文本
   * @param modified 修改後的文本
   */
  static generateStructuredDiff(original: string, modified: string): Diff.Change[] {
    return Diff.diffLines(original, modified);
  }

  /**
   * 生成單詞級別的 diff
   * @param original 原始文本
   * @param modified 修改後的文本
   */
  static generateWordDiff(original: string, modified: string): Diff.Change[] {
    return Diff.diffWords(original, modified);
  }

  /**
   * 生成字符級別的 diff
   * @param original 原始文本
   * @param modified 修改後的文本
   */
  static generateCharDiff(original: string, modified: string): Diff.Change[] {
    return Diff.diffChars(original, modified);
  }

  /**
   * 檢查 diff 是否可以安全套用
   * @param original 原始文本
   * @param patch unified diff 字串
   */
  static canApplyPatch(original: string, patch: string): boolean {
    try {
      const result = Diff.applyPatch(original, patch);
      return result !== false;
    } catch {
      return false;
    }
  }

  /**
   * 生成 HTML 格式的 diff 顯示
   * @param original 原始文本
   * @param modified 修改後的文本
   */
  static generateHtmlDiff(original: string, modified: string): string {
    const changes = Diff.diffLines(original, modified);
    let html = '<div class="diff-container">';
    
    let lineNumber = 1;
    
    for (const change of changes) {
      const lines = change.value.split('\n');
      // 移除最後一個空行
      if (lines[lines.length - 1] === '') {
        lines.pop();
      }
      
      for (const line of lines) {
        if (change.added) {
          html += `<div class="diff-line diff-added">+${line}</div>`;
        } else if (change.removed) {
          html += `<div class="diff-line diff-removed">-${line}</div>`;
        } else {
          html += `<div class="diff-line diff-context"> ${line}</div>`;
        }
        lineNumber++;
      }
    }
    
    html += '</div>';
    return html;
  }

  /**
   * 生成 Markdown 格式的 diff 顯示
   * @param original 原始文本
   * @param modified 修改後的文本
   * @param fileName 檔案名稱
   */
  static generateMarkdownDiff(original: string, modified: string, fileName?: string): string {
    const unifiedDiff = this.generateUnifiedDiff(original, modified, fileName);
    
    return `\`\`\`diff\n${unifiedDiff}\n\`\`\``;
  }

  /**
   * 合併多個 diff
   * @param diffs diff 字串陣列
   */
  static mergeDiffs(diffs: string[]): string {
    // 簡單的合併邏輯，實際應用中可能需要更複雜的衝突解決
    return diffs.join('\n');
  }

  /**
   * 反轉 diff（將添加變成刪除，刪除變成添加）
   * @param diffText unified diff 字串
   */
  static reverseDiff(diffText: string): string {
    const lines = diffText.split('\n');
    const reversedLines: string[] = [];
    
    for (const line of lines) {
      if (line.startsWith('+++')) {
        reversedLines.push(line.replace('+++', '---'));
      } else if (line.startsWith('---')) {
        reversedLines.push(line.replace('---', '+++'));
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        reversedLines.push('-' + line.substring(1));
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        reversedLines.push('+' + line.substring(1));
      } else if (line.startsWith('@@')) {
        // 交換行號範圍
        const match = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@(.*)/);
        if (match) {
          const [, oldStart, oldCount, newStart, newCount, context] = match;
          reversedLines.push(`@@ -${newStart},${newCount || '1'} +${oldStart},${oldCount || '1'} @@${context || ''}`);
        } else {
          reversedLines.push(line);
        }
      } else {
        reversedLines.push(line);
      }
    }
    
    return reversedLines.join('\n');
  }

  /**
   * 驗證 diff 格式是否正確
   * @param diffText unified diff 字串
   */
  static validateDiffFormat(diffText: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const lines = diffText.split('\n');
    
    let hasFileHeader = false;
    let hasHunkHeader = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 檢查檔案標頭
      if (line.startsWith('---') || line.startsWith('+++')) {
        hasFileHeader = true;
        continue;
      }
      
      // 檢查 hunk 標頭
      if (line.startsWith('@@')) {
        hasHunkHeader = true;
        const match = line.match(/@@ -\d+,?\d* \+\d+,?\d* @@/);
        if (!match) {
          errors.push(`第 ${i + 1} 行：無效的 hunk 標頭格式`);
        }
        continue;
      }
      
      // 檢查內容行
      if (hasHunkHeader && line.length > 0) {
        const firstChar = line[0];
        if (!['+', '-', ' '].includes(firstChar)) {
          errors.push(`第 ${i + 1} 行：無效的行前綴 '${firstChar}'`);
        }
      }
    }
    
    if (!hasFileHeader) {
      errors.push('缺少檔案標頭 (--- 和 +++)');
    }
    
    if (!hasHunkHeader) {
      errors.push('缺少 hunk 標頭 (@@)');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// 輔助函數
export function createDiffProcessor(): typeof DiffProcessor {
  return DiffProcessor;
}

// 預設導出
export default DiffProcessor; 