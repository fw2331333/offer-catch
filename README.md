# Offer 捕手

**版本：v1.1.0** · [更新日志](CHANGELOG.md)

面向学生的 **求职匹配助手**：岗位推荐、简历与岗位匹配分析、优化建议、AI 对话咨询。
**[使用指南](docs/用户指南.md)** · **[常见问题](docs/常见问题.md)**

注册后通过邮件设置密码，再登录使用。建议顺序：上传简历 → 填写求职意向 → 岗位库 / 匹配 / 对话。访问地址以实际部署为准（本机一般为 `http://localhost:8080`）。

---

## 快速体验（本机 Docker）

适合在自己电脑上试用。

### 环境

- 已安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)（Windows / Mac）或 Linux 上的 Docker  
- 准备好 [DeepSeek API Key](https://platform.deepseek.com/)（使用 AI 功能时需要）

### 启动

**Windows：**

```powershell
cd f:\offer-catch
copy .env.example .env   # 用记事本编辑，填入 DEEPSEEK_API_KEY
.\scripts\start.ps1
```

**Linux / macOS：**

```bash
cd offer-catch
cp .env.example .env
chmod +x scripts/start.sh
./scripts/start.sh
```

启动后在浏览器打开：**http://localhost:8080**

### 演示账号（可选）

- 邮箱：`demo@student.edu`  
- 密码：`demo1234`  

（首次启动可能自动创建；也可自行注册。）

---

## 主要功能

- 邮箱注册，邮件链接 **设置密码** 后登录  
- **求职意向**：城市、岗位、行业、实习/校招  
- **简历**：上传 PDF / Word / 文本并解析；侧栏可切换版本、**删除** 旧简历  
- **岗位库**：浏览、录入、心仪岗位（粘贴/截图）、AI 搜岗；**账号隔离**，可选 **共享** 给他人  
- **结合简历分析**：岗位列表与心仪岗位详情均可生成匹配报告（需简历 + API Key）  
- **匹配分析**：岗位库智能推荐、单岗深度报告、简历优化建议  
- **AI 对话**：求职相关问答；顶栏 **Offer 捕手** 返回主入口；退出登录带确认与动画  
- **AI 密钥**：侧栏或 `PUT /api/v1/settings/api-key` 配置个人 DeepSeek Key（见 [用户指南](docs/用户指南.md)）

---

## 开发与部署

| 文档 | 内容 |
|------|------|
| [CHANGELOG.md](CHANGELOG.md) | 版本更新记录 |
| [docs/README.md](docs/README.md) | 技术文档索引 |
| [DEPLOY.md](DEPLOY.md) | 云服务器部署（Docker、域名、HTTPS） |
| [docs/api-design.md](docs/api-design.md) | 接口说明 |
| [docs/database-design.md](docs/database-design.md) | 数据库设计 |
| [docs/auth-and-security.md](docs/auth-and-security.md) | 认证与安全（开发参考） |
| [docs/redis.md](docs/redis.md) | 限流与缓存（开发参考） |

**本地开发（非 Docker）：** 见原仓库 `backend` / `frontend` 目录下的依赖安装与 `uvicorn` / `npm run dev` 说明，或询问维护者。

**环境变量：** 复制 `.env.example` 为 `.env`，至少配置 `DEEPSEEK_API_KEY`、`JWT_SECRET`；生产环境还需 SMTP、`APP_PUBLIC_URL` 等，详见 `DEPLOY.md`。

---

## 安全提示

- 不要把 `.env` 或 API Key 提交到 Git、发到群聊  
- 生产环境请修改默认密码与 `JWT_SECRET`  
- 简历与 AI 建议仅供参考，投递前请自行核实信息真实性  

## License

MIT
