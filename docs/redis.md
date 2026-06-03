# Redis：登录限流与热点缓存

## 用途

| 功能 | Redis Key 前缀 | 说明 |
|------|----------------|------|
| 登录失败计数 | `rl:login:fail:email:` / `rl:login:fail:ip:` | 防暴力破解 |
| 忘记密码 / 重发验证 | `rl:forgot:email:` | 防刷邮件 |
| 岗位列表 | `cache:jobs:list:` | TTL 默认 60s |
| 岗位详情 | `cache:job:detail:{id}` | TTL 默认 300s |
| 求职画像 | `cache:profile:{user_id}` | TTL 默认 120s |

岗位增删改、AI 导入、画像更新时会自动失效相关缓存。

## 环境变量

见 `.env.example` 中 `LOGIN_RATE_LIMIT_*`、`FORGOT_PASSWORD_*`、`CACHE_TTL_*`。

## 健康检查

`GET /health` 返回 `"redis": true/false`。Redis 不可用时 API 启动会失败（`lifespan` 中 `init_redis`）。

## 登录限流规则（默认）

- 同一邮箱：15 分钟内最多 **5** 次密码错误
- 同一 IP：15 分钟内最多 **30** 次密码错误
- 忘记密码 / 重发验证：同一邮箱 **1 小时 3 次**

超限返回 HTTP **429**，前端会显示剩余等待秒数。
