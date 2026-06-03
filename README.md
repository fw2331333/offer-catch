# Offer 捕手

学生求职匹配智能体 — 岗位推荐、简历匹配分析、简历优化建议、DeepSeek 风格对话主界面。

## 功能一览

- 用户注册 / 登录（JWT）
- 求职意向配置
- 简历上传解析（PDF / DOCX / TXT + DeepSeek 结构化）
- 岗位库：手动录入、**心仪岗位（粘贴文本/截图）**、AI 查找与导入
- 心仪岗位 + 简历：一键匹配分析与优化建议
- 岗位库匹配与单岗深度报告
- 针对岗位的简历优化建议
- AI 对话助手（快速 / 专家 / 深度调研模式）

## 快速启动（Docker）

### 环境要求

- Docker Desktop 或 Docker Engine + Compose v2
- 已配置 `DEEPSEEK_API_KEY`（见 `.env`）

### Windows

```powershell
cd f:\offer-catch
.\scripts\start.ps1
```

### Linux / macOS

```bash
cd offer-catch
chmod +x scripts/start.sh
./scripts/start.sh
```

### 手动启动

```bash
cp .env.example .env   # 编辑填入 DEEPSEEK_API_KEY
docker compose -p offer-hunter up -d --build
```

> Docker 项目名为 **`offer-hunter`**（与目录名 `offer-catch` 区分），避免与旧容器/卷重名。  
> 端口：前端 **8080**、API **8001**、Postgres **5433**、Redis **6380**（不与默认 80/8000/5432/6379 冲突）。

### 国内拉镜像 / 构建失败？

**`lookup docker.m.daocloud.io: no such host`**  
当前网络无法解析 DaoCloud 域名。请从 `.env` 中 **删除或注释** 所有 `POSTGRES_IMAGE` / `PYTHON_IMAGE` 等 daocloud 行（项目默认已改回 `python:3.11-slim` 等官方名），然后重新 build。

**Hub 很慢或 `429`（含 xuanyuan.me）**  
1. Docker Desktop → Settings → Docker Engine：删掉 `docker.xuanyuan.me` 等失效镜像源。  
2. 可改用 1ms 代理前缀：

```powershell
cd f:\offer-catch
.\scripts\use-1ms-mirror.ps1
docker compose -p offer-hunter up -d --build
```

3. 或先预拉取再启动：

```powershell
.\scripts\pull-images.ps1
docker compose -p offer-hunter up -d --build
```

也可在 Docker Engine 配置 `registry-mirrors` 后重启 Docker Desktop。

**`RUN npm install` / `npm ci` 长时间无输出（像卡住）**  
1. 项目已改为 `npm ci` + `package-lock.json`，并排除 `node_modules` 进构建上下文。  
2. 在 `.env` 增加国内源后重建 web：

```powershell
# .env 中加一行
NPM_REGISTRY=https://registry.npmmirror.com

docker compose -p offer-hunter build --progress=plain web
```

3. 开启 BuildKit（Docker Desktop 默认已开）以使用 npm 缓存。首次安装约 1–3 分钟属正常，日志会显示 `npm http fetch`。

### 访问地址

| 服务 | 地址 |
|------|------|
| **前端** | http://localhost:8080 |
| **API 文档** | http://localhost:8001/docs |
| **健康检查** | http://localhost:8001/health |

### 演示账号

- 邮箱：`demo@student.edu`
- 密码：`demo1234`

（首次启动自动创建；也可自行注册）

## 推荐使用流程

1. 登录 → 主界面上传简历（回形针图标）
2. 「求职意向」填写城市、岗位方向
3. 「岗位库」→ **心仪岗位**：粘贴 BOSS/智联 JD 或上传截图 → **结合简历分析**
4. 或录入岗位 / **AI 查找** → 勾选导入
5. 「岗位库匹配」→ 开始推荐 → 查看报告 / 简历优化
6. 主对话中询问：「帮我推荐适合的实习」等

## 项目结构

```
offer-catch/
├── backend/          # FastAPI 后端
├── frontend/         # React + Vite 前端
├── docs/             # 需求、数据库、登录认证、缓存、接口文档（见 docs/README.md）
├── scripts/          # 启动脚本
├── docker-compose.yml
└── .env.example
```

## 本地开发（非 Docker）

**后端**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# 需本地 PostgreSQL，修改 DATABASE_URL
python -m app.init_db
uvicorn app.main:app --reload --port 8000
```

**前端**

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173 代理 /api → :8000
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥（必填） |
| `DEEPSEEK_BASE_URL` | 默认 `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | 默认 `deepseek-chat` |
| `JWT_SECRET` | JWT 签名密钥 |
| `DATABASE_URL` | 异步 PostgreSQL 连接串 |

## 文档

- [需求分析](docs/requirements.md)
- [数据库设计](docs/database-design.md)
- [接口设计](docs/api-design.md)
- [Redis 限流与缓存](docs/redis.md)
- **[服务器部署](DEPLOY.md)**

## 安全提示

- 密钥只写在 **`.env`**，仓库内仅有 **`.env.example`** 模板（见 `.gitignore`）
- **切勿将 `.env` 提交到 Git**
- 生产环境请更换 `JWT_SECRET` 与数据库密码；`EXPOSE_DEV_VERIFY_LINK=false`
- API Key 泄露后请在 DeepSeek 控制台轮换

## License

MIT
