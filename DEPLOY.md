# Offer 捕手 — 服务器部署指南

## 一、密钥会不会暴露？

| 做法 | 是否安全 |
|------|----------|
| 密钥写在 `.env`，且 **已加入 `.gitignore`** | ✅ 不会进 Git 仓库 |
| 仓库里只保留 `.env.example`（占位符，无真实 Key） | ✅ |
| 服务器上手动 `cp .env.example .env` 再填写 | ✅ |
| Docker 通过 `env_file: .env` 注入容器 | ✅ 不打进镜像层 |
| 把 `.env` 提交到 GitHub / 发群里 | ❌ 绝对不要 |

**结论：** 用 `.env` 存 `DEEPSEEK_API_KEY`、`JWT_SECRET`、`SMTP_PASSWORD` 是正确做法；只要 **不提交 `.env`**，就不会因代码仓库泄露。

上线前自检：

```bash
# 确认 .env 未被 git 跟踪（在项目根目录）
git status   # 不应出现 .env
```

---

## 二、服务器要求

- Ubuntu 22.04 LTS（推荐）
- 2 核 4G 内存起
- 已安装 Docker；Compose 可用 `docker compose` 或 `docker-compose`
- 域名已解析到服务器公网 IP（可选但推荐）
- 安全组放行：**22**（SSH）、**80**、**443**

---

## 三、安装 Docker（Ubuntu）

```bash
sudo apt update
sudo apt install -y docker.io docker-compose

docker --version
docker-compose --version

sudo usermod -aG docker $USER
# 重新登录 SSH 后生效
```

若需 `docker compose`（无横杠）插件，见 [Docker 官方文档](https://docs.docker.com/engine/install/ubuntu/)。

---

## 四、上传项目

```bash
cd ~
git clone <你的仓库地址> offer-catch
cd offer-catch
```

或本机打包上传后解压到 `~/offer-catch`。

---

## 五、配置环境变量

```bash
cp .env.example .env
nano .env
```

**生产必改：**

```env
DEEPSEEK_API_KEY=sk-你的密钥
JWT_SECRET=随机长串至少32位
POSTGRES_PASSWORD=强密码

APP_PUBLIC_URL=https://你的域名.com
CORS_ORIGINS=https://你的域名.com
EXPOSE_DEV_VERIFY_LINK=false

SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_USER=你的邮箱@qq.com
SMTP_PASSWORD=QQ邮箱SMTP授权码
SMTP_FROM=Offer Catch <你的邮箱@qq.com>
SMTP_USE_TLS=true
```

`POSTGRES_PASSWORD` 在 `.env` 里修改即可，`docker-compose.yml` 会自动拼进 `DATABASE_URL`。

---

## 六、启动

```bash
cd ~/offer-catch
sudo docker-compose -p offer-hunter up -d --build

若 `docker-compose.prod.yml` 报错（旧版不支持 `!reset`），用上面这一条即可。  
可选叠加（仅隐藏 API 宿主机端口）：`sudo docker-compose -f docker-compose.yml -f docker-compose.prod.yml -p offer-hunter up -d --build`
```

检查：

```bash
sudo docker-compose -p offer-hunter ps
curl http://127.0.0.1:8001/health
curl -I http://127.0.0.1:8080
```

`health` 应返回 `"redis": true`。

---

## 七、HTTPS（Caddy 示例）

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`：

```caddy
你的域名.com {
    reverse_proxy /api/* 127.0.0.1:8001
    reverse_proxy /*      127.0.0.1:8080
}
```

```bash
sudo systemctl reload caddy
```

浏览器访问 `https://你的域名.com`，走一遍注册 → 邮件设密码 → 登录。

---

## 八、生产安全清单

- [ ] `.env` 未提交到 Git
- [ ] `EXPOSE_DEV_VERIFY_LINK=false`
- [ ] `JWT_SECRET`、`POSTGRES_PASSWORD` 已更换
- [ ] 安全组 **未** 对公网开放 5433、6380、8001
- [ ] 演示账号 `demo@student.edu` 已改密或禁用（可选）
- [ ] 定期备份 Docker 卷 `offer-hunter-pgdata`、`offer-hunter-uploads`

---

## 九、常用命令

```bash
# 查看日志
sudo docker-compose -p offer-hunter logs -f api

# 更新代码后重新发布
cd ~/offer-catch && git pull
sudo docker-compose -p offer-hunter up -d --build

# 停止
sudo docker-compose -p offer-hunter down
```

---

## 十、本机开发（Windows）

```powershell
cd f:\offer-catch
.\scripts\start.ps1
```

访问 http://localhost:8080
