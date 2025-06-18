# Diff 工具使用指南

## 概述

AI Creator 系統現在包含了一套完整的 diff 工具，專門用於處理和應用標準的 unified diff 格式。這些工具讓 AI 可以更精確地修改檔案，特別適合處理複雜的程式碼變更。

## 🛠️ 可用工具

### 1. `validate_diff` - Diff 格式驗證工具

**功能**：驗證 diff 格式是否正確，但不應用修改
**分類**：utility
**用途**：在應用 diff 之前檢查格式是否正確

#### 參數

- `diffContent` (string, 必需): 要驗證的 diff 內容

#### 返回值

```typescript
{
  success: boolean;
  data?: {
    message: string;
    details: {
      hunksCount: number;
      oldFile?: string;
      newFile?: string;
      hunks: Array<{
        oldStart: number;
        oldCount: number;
        newStart: number;
        newCount: number;
        linesCount: number;
      }>;
    };
  };
  error?: string;
}
```

### 2. `local_apply_diff` - 本地 Diff 應用工具

**功能**：在本地檔案系統中應用 diff 格式的檔案修改
**分類**：filesystem
**用途**：直接修改專案根目錄中的檔案

#### 參數

- `filePath` (string, 必需): 要修改的檔案路徑（相對於專案根目錄）
- `diffContent` (string, 必需): 標準 unified diff 格式的內容

#### 返回值

```typescript
{
  success: boolean;
  data?: {
    message: string;
    filePath: string;
  };
  error?: string;
}
```

### 3. `docker_apply_diff` - Docker Diff 應用工具

**功能**：在 Docker 容器中應用 diff 格式的檔案修改
**分類**：docker
**用途**：修改 Docker 容器內的檔案

#### 參數

- `filePath` (string, 必需): 要修改的檔案路徑（相對於容器工作目錄）
- `diffContent` (string, 必需): 標準 unified diff 格式的內容

## 📋 Diff 格式要求

### 標準 Unified Diff 格式

1. **必須包含 hunk 標記**：`@@...@@`
2. **使用標準前綴**：
   - `+` 表示添加的行
   - `-` 表示刪除的行
   - ` ` (空格) 表示上下文行
3. **正確的行號格式**：`@@ -oldStart,oldCount +newStart,newCount @@`

### 範例 diff 格式

```diff
@@ -1,3 +1,4 @@
 第一行內容
-舊的第二行
+新的第二行
+新增的第三行
 最後一行
```

### 複雜範例

```diff
@@ -1,5 +1,6 @@
 import React from 'react';
-import { Component } from 'react';
+import { Component, useState } from 'react';

 function MyComponent() {
+  const [count, setCount] = useState(0);
   return (
     <div>
```

## 🚀 使用示例

### 1. 驗證 diff 格式

```typescript
// 使用 validate_diff 工具
const diffContent = `@@ -1,2 +1,3 @@
 第一行
-第二行
+修改的第二行
+新增的第三行`;

const result = await validateDiff({
  diffContent: diffContent,
});

if (result.success) {
  console.log("Diff 格式正確");
  console.log("Hunks 數量:", result.data.details.hunksCount);
} else {
  console.log("Diff 格式錯誤:", result.error);
}
```

### 2. 應用本地檔案修改

```typescript
// 使用 local_apply_diff 工具
const diffContent = `@@ -1,3 +1,4 @@
 console.log('Hello');
-console.log('World');
+console.log('Beautiful World');
+console.log('Welcome!');
 console.log('End');`;

const result = await localApplyDiff({
  filePath: "src/app.js",
  diffContent: diffContent,
});

if (result.success) {
  console.log("檔案修改成功:", result.data.message);
} else {
  console.log("檔案修改失敗:", result.error);
}
```

### 3. 應用 Docker 容器內檔案修改

```typescript
// 使用 docker_apply_diff 工具
const diffContent = `@@ -10,3 +10,4 @@
   "dependencies": {
     "react": "^18.0.0",
-    "next": "^13.0.0"
+    "next": "^14.0.0",
+    "typescript": "^5.0.0"
   }`;

const result = await dockerApplyDiff({
  filePath: "package.json",
  diffContent: diffContent,
});
```

## ⚠️ 注意事項

### 1. 路徑安全

- 本地工具會自動檢查路徑安全性，防止路徑遍歷攻擊
- 不允許使用 `..` 等危險路徑字符

### 2. 檔案編碼

- 所有工具假設檔案使用 UTF-8 編碼
- 二進制檔案不受支援

### 3. 上下文匹配

- Diff 應用時會嚴格檢查上下文行是否匹配
- 如果上下文不匹配，操作會失敗並返回詳細錯誤信息

### 4. 原子性操作

- 本地工具使用原子性寫入，失敗時不會損壞原檔案
- Docker 工具使用臨時檔案確保操作安全

## 🔧 錯誤處理

### 常見錯誤類型

1. **格式錯誤**

   ```
   無效的 diff 格式：未找到任何 diff hunk (@@...@@)
   ```

2. **上下文不匹配**

   ```
   Diff 應用失敗：第 5 行上下文不匹配
   期望: "console.log('test');"
   實際: "console.log('debug');"
   ```

3. **檔案不存在**
   ```
   ENOENT: no such file or directory, open 'missing-file.txt'
   ```

### 重試建議

- 檢查 diff 格式是否符合 unified diff 標準
- 確認檔案路徑正確且檔案存在
- 驗證上下文行是否與目標檔案內容完全匹配
- 使用 `validate_diff` 工具預先檢查格式

## 📊 工具整合狀態

✅ **已完成的功能**

- Diff 格式解析和驗證
- 本地檔案系統支援
- Docker 容器支援
- 詳細錯誤報告
- 原子性操作
- 路徑安全檢查

✅ **測試覆蓋**

- 格式驗證測試
- 成功應用測試
- 錯誤處理測試
- 邊界情況測試

✅ **系統整合**

- 已整合到統一工具系統
- 支援 OpenAI Function Call
- 包含完整的元數據
- 支援工具註冊和發現

## 🎯 使用場景

### 1. 精確的程式碼修改

當需要對檔案進行精確修改時，diff 工具比完整檔案重寫更安全和高效。

### 2. 版本控制友好

生成的修改記錄與 Git diff 格式兼容，便於版本控制和審查。

### 3. 大檔案部分修改

對於大型檔案，只需要傳輸和處理變更部分，提高效率。

### 4. 批量修改

可以在單個 diff 中包含多個修改點，實現複雜的檔案變更。

## 🔮 未來擴展

- 支援更多 diff 格式（context diff、ed script 等）
- 批量 diff 應用
- Diff 衝突解決
- 互動式 diff 應用
- Diff 預覽和確認機制
