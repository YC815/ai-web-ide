# Langchain 智能檔案搜尋功能

## 🎯 功能概述

基於用戶反饋 "我希望 AI 可以自行理解我是要到特定資料夾找到本檔案，不是單純在當前目錄找此檔案，然後自己 path 到該檔案看內容不要我指引"，我們實現了智能檔案搜尋功能。

## 🚨 解決的問題

### 修復前

```
用戶：查看主頁page.tsx
AI：在專案目錄中沒有找到名為 `page.tsx` 的檔案。請確認檔案名稱是否正確...
```

### 修復後

````
用戶：查看主頁page.tsx
AI：✅ 找到檔案：./src/app/page.tsx
📍 位置類型：app-router
🔍 其他匹配檔案：./src/pages/index.tsx

📄 檔案內容：
```typescript
export default function HomePage() {
  return (
    <div>
      <h1>歡迎來到主頁</h1>
    </div>
  );
}
````

📊 檔案分析：
📏 檔案大小：12 行，245 字元
🏷️ 檔案類型：typescript
⚛️ React 組件：包含導出組件
📦 導入模組：3 個
🔧 函數數量：1 個

````

## 🔧 核心功能

### 1. 智能檔案名稱提取

自動從用戶輸入中識別檔案名稱：

```typescript
private extractFileName(input: string): string | null {
  // 支援多種表達方式
  const searchPatterns = [
    /查看\s*(.+\.(?:tsx?|jsx?|json|md|css|scss|html))/i,
    /看看\s*(.+\.(?:tsx?|jsx?|json|md|css|scss|html))/i,
    /打開\s*(.+\.(?:tsx?|jsx?|json|md|css|scss|html))/i,
    /顯示\s*(.+\.(?:tsx?|jsx?|json|md|css|scss|html))/i,
    /(\w+\.(?:tsx?|jsx?|json|md|css|scss|html))/i,
  ];

  // 特殊處理：常見的檔案描述
  const specialCases = {
    '主頁': 'page.tsx',
    '首頁': 'page.tsx',
    '主頁面': 'page.tsx',
    '根頁面': 'page.tsx',
    '配置': 'package.json',
    '設定': 'next.config',
    'README': 'README.md'
  };
}
````

### 2. 智能搜尋策略

#### 優先級目錄搜尋

```typescript
const searchDirectories = [
  { path: "src/app", priority: 10, type: "app-router" }, // Next.js App Router
  { path: "src/pages", priority: 9, type: "pages-router" }, // Next.js Pages Router
  { path: "src/components", priority: 8, type: "component" }, // React 組件
  { path: "src/lib", priority: 7, type: "library" }, // 函式庫
  { path: "src", priority: 6, type: "source" }, // 原始碼根目錄
  { path: "pages", priority: 5, type: "legacy-pages" }, // 舊版頁面
  { path: "components", priority: 4, type: "legacy-component" }, // 舊版組件
  { path: "", priority: 3, type: "root" }, // 專案根目錄
  { path: "public", priority: 2, type: "static" }, // 靜態資源
  { path: "docs", priority: 1, type: "documentation" }, // 文檔
];
```

#### 遞迴深度搜尋

- 最多搜尋 3 層深度
- 自動跳過 `node_modules`, `.git`, `.next` 目錄
- 智能處理檔案和目錄的區別

### 3. 智能匹配算法

#### 檔案匹配規則

1. **完全匹配** - 檔案名稱完全相同
2. **去副檔名匹配** - 忽略副檔名比較
3. **部分匹配** - 包含關係匹配
4. **相似度匹配** - 使用編輯距離算法

#### 分數計算系統

```typescript
private calculateFileScore(fileName: string, targetFileName: string, basePriority: number, type: string): number {
  let score = basePriority;

  // 完全匹配加分
  if (fileName.toLowerCase() === targetFileName.toLowerCase()) {
    score += 50;
  }

  // 檔案名稱相似度加分
  const similarity = this.calculateStringSimilarity(fileName.toLowerCase(), targetFileName.toLowerCase());
  score += Math.floor(similarity * 20);

  // 特殊檔案類型加分
  if (fileName === 'page.tsx' || fileName === 'page.js') {
    score += 30; // 主頁面加分
  }
  if (fileName === 'index.tsx' || fileName === 'index.js') {
    score += 20; // 索引檔案加分
  }
  if (fileName.includes('component') || fileName.includes('Component')) {
    score += 10; // 組件檔案加分
  }

  return score;
}
```

### 4. 檔案內容分析

自動分析檔案內容並提供洞察：

```typescript
private analyzeFileContent(content: string, filePath: string): string {
  const analysis: string[] = [];

  // 檔案大小分析
  const lines = content.split('\n');
  analysis.push(`📏 檔案大小：${lines.length} 行，${content.length} 字元`);

  // React 組件分析
  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
    if (content.includes('export default') || content.includes('export function')) {
      analysis.push(`⚛️ React 組件：包含導出組件`);
    }
    if (content.includes('useState') || content.includes('useEffect')) {
      analysis.push(`🎣 使用 Hooks：useState, useEffect 等`);
    }
  }

  // 導入和函數分析
  const imports = content.match(/^import .+$/gm);
  const functions = content.match(/(?:function|const .+?=|export function)/g);

  if (imports?.length) analysis.push(`📦 導入模組：${imports.length} 個`);
  if (functions?.length) analysis.push(`🔧 函數數量：${functions.length} 個`);

  return analysis.join('\n');
}
```

## 🎯 自動觸發機制

### 觸發詞彙識別

AI 會自動識別以下類型的請求並使用智能檔案搜尋：

#### 直接檔案請求

- "查看 page.tsx"
- "看看 component.js"
- "打開 config.json"
- "顯示 README.md"

#### 語義化請求

- "主頁" → 搜尋 `page.tsx`
- "首頁" → 搜尋 `page.tsx`
- "配置" → 搜尋 `package.json`
- "設定" → 搜尋 `next.config.*`
- "README" → 搜尋 `README.md`

#### 檔案類型請求

- 任何包含副檔名的文字：`.tsx`, `.ts`, `.jsx`, `.js`, `.json`, `.md`, `.css`, `.scss`, `.html`

### 系統提示整合

更新了 Langchain 引擎的系統提示：

```
### 🎯 檔案搜尋智能識別
當用戶提到以下模式時，自動使用 `intelligent_file_search`：
- "查看 [檔案名]"、"看看 [檔案名]"、"打開 [檔案名]"
- "主頁"、"首頁"、"根頁面" → 自動搜尋 page.tsx
- "配置"、"設定" → 自動搜尋配置檔案
- 任何包含檔案副檔名的請求 (.tsx, .ts, .jsx, .js, .json, .md)

❌ **絕對禁止**: 說找不到檔案就結束
✅ **正確做法**: 自動使用專用工具進行智能搜尋
```

## 🚀 使用範例

### 範例 1：主頁搜尋

```
用戶：查看主頁page.tsx
AI：自動執行 intelligent_file_search → 找到 src/app/page.tsx → 顯示完整內容和分析
```

### 範例 2：組件搜尋

```
用戶：看看 Button 組件
AI：自動執行 intelligent_file_search → 搜尋 Button.tsx/Button.js → 顯示最佳匹配
```

### 範例 3：配置檔案搜尋

```
用戶：配置檔案
AI：自動執行 intelligent_file_search → 找到 package.json → 顯示內容和依賴分析
```

### 範例 4：模糊搜尋

```
用戶：chat相關的檔案
AI：自動執行 intelligent_file_search → 找到所有包含 "chat" 的檔案 → 按相關性排序
```

## 📊 技術優勢

1. **零配置** - 無需用戶指定路徑
2. **智能理解** - 理解語義化檔案描述
3. **全專案搜尋** - 不限於當前目錄
4. **相關性排序** - 自動選擇最佳匹配
5. **詳細分析** - 提供檔案內容洞察
6. **錯誤容忍** - 支援部分匹配和模糊搜尋

## 🔄 與其他功能整合

- **專案探索** - 使用 `comprehensive_project_exploration` 進行全面分析
- **檔案搜尋** - 使用 `intelligent_file_search` 進行精確檔案定位
- **專案路徑檢測** - 使用 `detect_project_path` 確保正確的搜尋起點

## 📝 後續改進計劃

1. **語義搜尋** - 基於檔案內容的語義搜尋
2. **多檔案比較** - 同時顯示多個相關檔案
3. **依賴關係分析** - 顯示檔案之間的導入關係
4. **代碼片段提取** - 自動提取關鍵代碼片段
5. **版本歷史** - 整合 Git 歷史資訊

這個功能讓 AI 真正成為了智能的檔案導航助手！🎉
