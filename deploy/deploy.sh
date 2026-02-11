#!/bin/bash
# OIS Web 部署脚本
# 用法: bash deploy.sh

set -e

PROJECT_DIR="/data/data/OpenclawInterSystem"
SERVICE_NAME="ois-web"

echo "=== OIS Web 部署 ==="

# 1. 拉取最新代码
echo "[1/6] 拉取代码..."
cd "$PROJECT_DIR"
git pull origin main

# 2. 安装依赖
echo "[2/6] 安装依赖..."
cd "$PROJECT_DIR/ois-web"
npm install --production

# 3. 检查 .env
if [ ! -f .env ]; then
  echo "[!] .env 文件不存在，从模板创建..."
  cp .env.example .env
  echo "[!] 请编辑 /data/data/OpenclawInterSystem/ois-web/.env 填入真实配置"
  echo "[!] 然后重新运行此脚本"
  exit 1
fi

# 4. 创建必要目录
echo "[3/6] 创建目录..."
mkdir -p /tmp/ois-uploads
mkdir -p "$PROJECT_DIR/ois-web/data"

# 5. 安装 systemd service
echo "[4/6] 安装 systemd service..."
cp "$PROJECT_DIR/deploy/ois-web.service" /etc/systemd/system/ois-web.service
systemctl daemon-reload

# 6. 启动服务
echo "[5/6] 启动服务..."
systemctl enable ois-web
systemctl restart ois-web

# 7. 检查状态
echo "[6/6] 检查状态..."
sleep 2
systemctl status ois-web --no-pager

echo ""
echo "=== 部署完成 ==="
echo "服务: systemctl status ois-web"
echo "日志: journalctl -u ois-web -f"
echo "地址: http://$(hostname -I | awk '{print $1}'):8800"
