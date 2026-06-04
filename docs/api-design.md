# Offer 捕手 — 接口设计文档

> **API v1.1.0** · 面向开发者。用户文档见 [用户指南](./用户指南.md)。

**Base URL**：`http://localhost:8000`（Docker 内前端经 Nginx 代理 `/api`）

**认证**：除注册/登录外，Header 携带 `Authorization: Bearer <token>`

## 1. 认证 `/api/v1/auth`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/register` | 注册，返回 token |
| POST | `/login` | 登录 |
| GET | `/me` | 当前用户 |

**注册请求体**（注册时不填密码，邮件链接设密）：

```json
{"email": "a@b.com", "username": "张三"}
```

其他：`POST /forgot-password`、`GET /verify-email-token`、`POST /complete-email-token` 等见 `auth.py` 与 [auth-and-security.md](./auth-and-security.md)。

## 2. 求职画像 `/api/v1/profile`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 获取画像 |
| PUT | `/` | 更新画像 |

## 3. 简历 `/api/v1/resumes`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 当前用户全部简历列表 |
| GET | `/latest` | 当前激活简历 |
| POST | `/upload` | multipart 上传 |
| DELETE | `/{resume_id}` | 删除简历（删当前则自动激活最新一条） |
| POST | `/optimize` | body: `{"job_id": 1}` |

## 4. 岗位 `/api/v1/jobs`

列表/详情/推荐/搜索均按 **可见性** 过滤（见 `app/services/job_visibility.py`）：

- `source=seed`：全员可见  
- `created_by_user_id = 当前用户`：本人岗位  
- `is_shared=true` 且录入者非本人：他人共享岗位  

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 列表，参数：city, job_type, source, q, limit（仅可见岗位） |
| POST | `/` | 手动录入岗位（默认 `is_shared=false`） |
| POST | `/ai-search` | AI + 岗位库联合查找 |
| POST | `/ai-import` | 将 AI 发现岗位导入库 |
| POST | `/parse-text` | 粘贴 JD 文本解析并可选保存（source=paste） |
| POST | `/parse-screenshot` | 上传截图 OCR+解析（source=screenshot） |
| POST | `/{job_id}/resume-analysis` | 结合当前简历：匹配报告+优化建议 |
| GET | `/{job_id}` | 详情（不可见则 404） |
| PATCH | `/{job_id}/share` | body: `{"shared": true}`，切换是否共享（仅本人录入岗） |
| PUT | `/{job_id}` | 更新（仅 manual/ai 等且本人） |
| DELETE | `/{job_id}` | 删除（仅本人可管岗位） |

**AI 查找请求**：

```json
{"query": "上海 数据分析 实习", "limit": 8, "include_ai_discovery": true}
```

**AI 导入请求**：

```json
{"jobs": [{ "company": "...", "title": "...", "city": "...", "description": "..." }]}
```

## 5. 匹配 `/api/v1/match`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/recommend` | body: `{"limit":10,"city":null,"job_type":null}` |
| GET | `/jobs/{job_id}/report` | 单岗匹配报告 |

**推荐响应示例**：

```json
{
  "items": [
    {
      "job_id": 1,
      "company": "字节跳动",
      "title": "数据分析实习生",
      "city": "北京",
      "overall_score": 82.5,
      "explanation": "...",
      "recommendation": "strong"
    }
  ],
  "resume_uploaded": true,
  "profile_complete": true
}
```

## 6. 对话 `/api/v1/chat`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/sessions` | 会话列表 |
| POST | `/sessions` | 创建会话 |
| GET | `/sessions/{id}/messages` | 消息历史 |
| POST | `/send` | 发送消息 |

**发送消息**：

```json
{
  "message": "帮我推荐北京的实习",
  "session_id": null,
  "mode": "fast",
  "deep_think": false,
  "smart_search": true
}
```

## 7. 用户设置 `/api/v1/settings`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api-key` | 是否已配置 Key（用户 Key 或服务器默认） |
| PUT | `/api-key` | body: `{"api_key": "sk-..."}` |
| DELETE | `/api-key` | 清除用户自填 Key |

## 8. 系统

| 方法 | 路径 |
|------|------|
| GET | `/health` |
| GET | `/docs` | Swagger UI |

## 9. 错误码

| HTTP | 含义 |
|------|------|
| 400 | 参数/业务错误 |
| 401 | 未登录或 token 无效 |
| 404 | 资源不存在 |
