#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "已创建 .env，请配置 DEEPSEEK_API_KEY"
fi

docker compose -p offer-hunter up -d --build

echo ""
echo "启动完成！（Offer 捕手 v1.1）"
echo "  前端: http://localhost:8080"
echo "  API:  http://localhost:8001/docs"
echo "  演示账号: demo@student.edu / demo1234"
echo ""
echo "停止: docker compose -p offer-hunter down"
