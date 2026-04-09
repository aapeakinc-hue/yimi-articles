#!/bin/bash

export TZ='Asia/Shanghai'

echo "=========================================="
echo "  一弭文章自动发布系统"
echo "=========================================="
echo "开始时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi

if [ ! -d "articles" ]; then
    echo "❌ articles 目录不存在"
    exit 1
fi

echo "📦 检查依赖..."
if [ ! -d "node_modules" ]; then
    npm install
fi

echo "🚀 开始发布..."
node scripts/publish.js

echo ""
echo "结束时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
