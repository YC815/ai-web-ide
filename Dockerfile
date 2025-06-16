# AI Web IDE Docker 配置
# 基於 Node.js 的容器化開發環境

# 使用官方 Node.js 18 LTS 版本
FROM node:18-alpine AS base

# 設置工作目錄
WORKDIR /app

# 安裝系統依賴
RUN apk add --no-cache \
    git \
    openssh-client \
    curl \
    bash \
    && rm -rf /var/cache/apk/*

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴
RUN npm ci --only=production

# 開發階段
FROM base AS development

# 安裝開發依賴
RUN npm ci

# 複製源代碼
COPY . .

# 暴露端口
EXPOSE 3000

# 設置環境變數
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# 健康檢查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# 啟動開發服務器
CMD ["npm", "run", "dev"]

# 生產階段
FROM base AS production

# 複製源代碼
COPY . .

# 建置應用
RUN npm run build

# 暴露端口
EXPOSE 3000

# 設置環境變數
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 健康檢查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# 啟動生產服務器
CMD ["npm", "start"] 