// Core DiffProcessor 模組測試
import { DiffProcessor } from '@/lib/core/diff-processor';

describe('DiffProcessor', () => {
  const originalText = `function hello() {
  console.log("Hello");
  return "world";
}`;

  const modifiedText = `function hello() {
  console.log("Hello, World!");
  return "world";
}`;

  describe('generateUnifiedDiff', () => {
    it('應該生成正確的 unified diff', () => {
      const diff = DiffProcessor.generateUnifiedDiff(originalText, modifiedText, 'test.js');
      
      expect(diff).toContain('test.js');
      expect(diff).toContain('-  console.log("Hello");');
      expect(diff).toContain('+  console.log("Hello, World!");');
      expect(diff).toContain('@@');
    });

    it('應該處理空文件', () => {
      const diff = DiffProcessor.generateUnifiedDiff('', 'new content', 'empty.txt');
      
      expect(diff).toContain('+new content');
      // 空文件到有內容的文件，不會有刪除行，但會有 diff 標記
      expect(diff).toContain('@@');
    });

    it('應該處理相同文件', () => {
      const diff = DiffProcessor.generateUnifiedDiff(originalText, originalText, 'same.txt');
      
      // 相同文件應該沒有差異
      expect(diff).not.toContain('@@');
    });
  });

  describe('applyUnifiedDiff', () => {
    it('應該正確套用 unified diff', () => {
      const diff = DiffProcessor.generateUnifiedDiff(
        originalText,
        modifiedText,
        'test.js'
      );

      const result = DiffProcessor.applyUnifiedDiff(originalText, diff);
      expect(result).toBe(modifiedText);
    });

    it('應該處理無效的 patch', () => {
      const invalidPatch = 'invalid patch content';
      
      // diff 庫對於無效的 patch 會返回原始文本，不會拋出錯誤
      const result = DiffProcessor.applyUnifiedDiff(originalText, invalidPatch);
      expect(result).toBe(originalText); // 應該返回原始文本
    });

    it('應該處理衝突的 patch', () => {
      const conflictingText = `function hello() {
  console.log("Different change");
  return "world";
}`;

      const diff = DiffProcessor.generateUnifiedDiff(
        originalText,
        modifiedText,
        'test.js'
      );

      expect(() => {
        DiffProcessor.applyUnifiedDiff(conflictingText, diff);
      }).toThrow();
    });
  });

  describe('parseUnifiedDiff', () => {
    it('應該正確解析 unified diff', () => {
      const diff = DiffProcessor.generateUnifiedDiff(
        originalText,
        modifiedText,
        'test.js'
      );

      const parsed = DiffProcessor.parseUnifiedDiff(diff);
      
      expect(parsed).toHaveLength(1);
      expect(parsed[0].oldFileName).toContain('test.js');
      expect(parsed[0].newFileName).toContain('test.js');
      expect(parsed[0].hunks).toHaveLength(1);
      
      const hunk = parsed[0].hunks[0];
      expect(hunk.lines.some(line => line.type === 'add')).toBe(true);
      expect(hunk.lines.some(line => line.type === 'remove')).toBe(true);
    });
  });

  describe('calculateDiffStats', () => {
    it('應該正確計算 diff 統計', () => {
      const diff = DiffProcessor.generateUnifiedDiff(
        originalText,
        modifiedText,
        'test.js'
      );

      const stats = DiffProcessor.calculateDiffStats(diff);
      
      expect(stats.additions).toBeGreaterThan(0);
      expect(stats.deletions).toBeGreaterThan(0);
      expect(stats.changes).toBe(stats.additions + stats.deletions);
    });

    it('應該處理只有新增的情況', () => {
      const diff = DiffProcessor.generateUnifiedDiff('', 'new content', 'new.txt');
      const stats = DiffProcessor.calculateDiffStats(diff);
      
      expect(stats.additions).toBeGreaterThan(0);
      expect(stats.deletions).toBe(0);
    });

    it('應該處理只有刪除的情況', () => {
      const diff = DiffProcessor.generateUnifiedDiff('old content', '', 'deleted.txt');
      const stats = DiffProcessor.calculateDiffStats(diff);
      
      expect(stats.additions).toBe(0);
      expect(stats.deletions).toBeGreaterThan(0);
    });
  });

  describe('generateStructuredDiff', () => {
    it('應該生成結構化的 diff', () => {
      const changes = DiffProcessor.generateStructuredDiff(originalText, modifiedText);
      
      expect(Array.isArray(changes)).toBe(true);
      expect(changes.some(change => change.added)).toBe(true);
      expect(changes.some(change => change.removed)).toBe(true);
    });
  });

  describe('generateWordDiff', () => {
    it('應該生成單詞級別的 diff', () => {
      const simple1 = 'hello world';
      const simple2 = 'hello beautiful world';
      
      const changes = DiffProcessor.generateWordDiff(simple1, simple2);
      
      expect(changes.some(change => change.added && change.value.includes('beautiful'))).toBe(true);
    });
  });

  describe('generateCharDiff', () => {
    it('應該生成字符級別的 diff', () => {
      const simple1 = 'hello';
      const simple2 = 'hallo';
      
      const changes = DiffProcessor.generateCharDiff(simple1, simple2);
      
      expect(changes.some(change => change.removed && change.value === 'e')).toBe(true);
      expect(changes.some(change => change.added && change.value === 'a')).toBe(true);
    });
  });

  describe('canApplyPatch', () => {
    it('應該正確檢測可套用的 patch', () => {
      const diff = DiffProcessor.generateUnifiedDiff(
        originalText,
        modifiedText,
        'test.js'
      );

      const canApply = DiffProcessor.canApplyPatch(originalText, diff);
      expect(canApply).toBe(true);
    });

    it('應該正確檢測不可套用的 patch', () => {
      // 使用一個真正無效的 patch 格式
      const invalidPatch = `--- invalid.txt
+++ invalid.txt
@@ -999,1 +999,1 @@
-nonexistent line
+replacement line`;
      
      const canApply = DiffProcessor.canApplyPatch(originalText, invalidPatch);
      expect(canApply).toBe(false);
    });
  });

  describe('generateHtmlDiff', () => {
    it('應該生成 HTML 格式的 diff', () => {
      const html = DiffProcessor.generateHtmlDiff(originalText, modifiedText);
      
      expect(html).toContain('<div class="diff-container">');
      expect(html).toContain('diff-added');
      expect(html).toContain('diff-removed');
      expect(html).toContain('diff-context');
    });
  });

  describe('generateMarkdownDiff', () => {
    it('應該生成 Markdown 格式的 diff', () => {
      const markdown = DiffProcessor.generateMarkdownDiff(
        originalText,
        modifiedText,
        'test.js'
      );
      
      expect(markdown).toContain('```diff');
      expect(markdown).toContain('```');
      expect(markdown).toContain('test.js');
    });
  });

  describe('reverseDiff', () => {
    it('應該正確反轉 diff', () => {
      const diff = DiffProcessor.generateUnifiedDiff(
        originalText,
        modifiedText,
        'test.js'
      );

      const reversedDiff = DiffProcessor.reverseDiff(diff);
      
      // 套用反轉的 diff 應該回到原始狀態
      const result = DiffProcessor.applyUnifiedDiff(modifiedText, reversedDiff);
      expect(result).toBe(originalText);
    });
  });

  describe('validateDiffFormat', () => {
    it('應該驗證正確的 diff 格式', () => {
      // 使用一個簡單的有效 diff 來測試驗證功能
      const validDiff = `--- test.js
+++ test.js
@@ -1,3 +1,3 @@
 function hello() {
-  console.log("Hello");
+  console.log("Hello, World!");
 }`;

      const validation = DiffProcessor.validateDiffFormat(validDiff);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('應該檢測無效的 diff 格式', () => {
      const invalidDiff = `invalid diff format
without proper headers
and wrong line prefixes`;

      const validation = DiffProcessor.validateDiffFormat(invalidDiff);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('應該檢測缺少檔案標頭的 diff', () => {
      const diffWithoutHeaders = `@@ -1,3 +1,3 @@
 function hello() {
-  console.log("Hello");
+  console.log("Hello, World!");
 }`;

      const validation = DiffProcessor.validateDiffFormat(diffWithoutHeaders);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(error => error.includes('檔案標頭'))).toBe(true);
    });
  });

  describe('mergeDiffs', () => {
    it('應該合併多個 diff', () => {
      const diff1 = DiffProcessor.generateUnifiedDiff('a', 'b', 'file1.txt');
      const diff2 = DiffProcessor.generateUnifiedDiff('c', 'd', 'file2.txt');
      
      const merged = DiffProcessor.mergeDiffs([diff1, diff2]);
      
      expect(merged).toContain('file1.txt');
      expect(merged).toContain('file2.txt');
    });
  });
}); 