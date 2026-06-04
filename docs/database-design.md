# Offer 捕手 — 数据库设计

## 1. 技术选型

| 组件 | 选型 | 说明 |
|------|------|------|
| 数据库 | PostgreSQL 16 | 主存储，Docker 映射端口 **5433** |
| ORM | SQLAlchemy 2.0 + asyncpg | 异步访问 |
| 迁移 | `app/db/migrate.py` | 启动时幂等 `ALTER`，补字段 |
| 建表 | `Base.metadata.create_all` + `init_db` | 首次启动建表 + 种子数据 |

连接串（Docker 内）：`postgresql+asyncpg://offer:offer123@db:5432/offer_catch`

## 2. ER 关系图

```mermaid
erDiagram
    users ||--o| student_profiles : has
    users ||--o{ resumes : owns
    users ||--o{ chat_sessions : owns
    users ||--o{ match_results : generates
    chat_sessions ||--o{ chat_messages : contains
    job_postings ||--o{ match_results : matched_by
    users ||--o{ job_postings : creates_optional

    users {
        int id PK
        string email UK
        string hashed_password
        text encrypted_api_key
    }
    student_profiles {
        int user_id FK UK
        jsonb target_cities
        jsonb target_roles
    }
    resumes {
        int user_id FK
        boolean is_active
        jsonb structured
    }
    job_postings {
        int id PK
        string city
        string source
    }
    match_results {
        int user_id FK
        int job_id FK
        string analysis_status
    }
```

## 3. 表结构说明

### 3.1 users（用户 / 登录账号）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | 用户 ID，JWT `sub` 即此值 |
| email | VARCHAR(255) UNIQUE | 登录邮箱 |
| username | VARCHAR(100) | 显示昵称 |
| hashed_password | VARCHAR(255) | bcrypt 哈希，不可逆 |
| encrypted_api_key | TEXT | 用户自填 DeepSeek Key（Fernet 加密） |
| created_at | TIMESTAMPTZ | 注册时间 |

### 3.2 student_profiles（求职意向）

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | INT FK → users | 一对一 |
| target_cities | JSONB | `["上海","北京"]` |
| target_roles | JSONB | `["数据分析","后端开发"]` |
| industries | JSONB | 意向行业 |
| salary_min / salary_max | INT | 期望薪资（可选） |
| job_type | VARCHAR(50) | 实习 / 校招 等 |
| bio | TEXT | 自由补充 |

### 3.3 resumes（简历）

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | INT FK | 所属用户 |
| filename / file_path | VARCHAR | 原文件名与磁盘路径（`uploads` 卷） |
| raw_text | TEXT | PDF/Word 抽取纯文本 |
| structured | JSONB | AI 结构化结果（见下） |
| version | INT | 上传序号递增 |
| is_active | BOOLEAN | **当前用于匹配/对话的简历**（仅一条为 true） |

**structured 示例**：

```json
{
  "basics": {"name": "", "email": "", "phone": ""},
  "education": [{"school": "", "degree": "", "major": ""}],
  "experience": [{"company": "", "role": "", "bullets": []}],
  "projects": [{"name": "", "tech_stack": [], "bullets": []}],
  "skills": {"hard": ["Python", "SQL"], "soft": []},
  "certificates": []
}
```

### 3.4 job_postings（岗位库）

| 字段 | 类型 | 说明 |
|------|------|------|
| company / title | VARCHAR | 公司、岗位名 |
| city | VARCHAR(100) | 索引，用于筛选 |
| job_type | VARCHAR(50) | 实习 / 校招 |
| salary_min / salary_max | INT | 薪资区间 |
| industry | VARCHAR | 行业 |
| description | TEXT | JD 全文 |
| requirements | JSONB | 技能、学历等 |
| tags | JSONB | 标签数组 |
| source | VARCHAR(30) | `seed` / `manual` / `ai` / `paste` / `screenshot` / `file` |
| source_url | VARCHAR(500) | 招聘链接（可选） |
| created_by_user_id | INT FK | 录入者（种子岗为空） |
| is_shared | BOOLEAN | 默认 `false`；为 `true` 时其他用户可在列表中看到（seed 岗忽略此字段逻辑） |

**可见性规则**（实现：`app/services/job_visibility.py`）：

1. 种子岗位（`source=seed`）→ 所有用户可见  
2. `created_by_user_id = 当前用户` → 本人岗位始终可见、可编辑/共享  
3. 他人岗位且 `is_shared=true` → 只读可见，列表展示 `shared_by_username`

### 3.5 match_results（匹配结果缓存）

岗位库匹配页 AI 分析结果持久化，供列表分数与报告秒开。

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id + job_id | FK | 唯一索引 `uq_match_results_user_job` |
| overall_score | FLOAT | AI 综合分（可空=未分析） |
| dimension_scores | JSONB | 各维度分 |
| explanation | TEXT | 列表摘要 |
| report | JSONB | 完整报告（匹配项/缺口/风险等） |
| analysis_status | VARCHAR(20) | `pending` / `analyzing` / `completed` / `failed` |
| progress | INT | 0–100，流式分析进度 |
| updated_at | TIMESTAMPTZ | 最近更新 |

### 3.6 chat_sessions / chat_messages（对话）

| 表 | 关键字段 |
|----|----------|
| chat_sessions | user_id, title, mode（fast 等）, updated_at |
| chat_messages | session_id, role（`user`/`assistant`）, content（助手消息可含思考标记） |

## 4. 索引与约束

- `users.email` UNIQUE
- `student_profiles.user_id` UNIQUE
- `job_postings(city)`, `job_postings(title)`, `job_postings(source)`
- `match_results(user_id, job_id)` UNIQUE
- 外键普遍 `ON DELETE CASCADE`（删用户级联删简历/会话/匹配记录）

## 5. 文件存储（非 DB）

| 类型 | 路径 | 说明 |
|------|------|------|
| 简历文件 | `uploads/{user_id}_{uuid}.pdf` | Docker 卷 `offer-hunter-uploads` |
| 岗位截图 | `uploads/jobshots/` | OCR 用 |
| 岗位文档 | `uploads/jobdocs/` | 录入解析用 |

## 6. 初始化数据

- `python -m app.init_db`（容器启动时自动执行）
- 约 10 条种子岗位（`source=seed`）
- 演示账号：`demo@student.edu` / `demo1234`

## 7. 相关代码

| 路径 | 职责 |
|------|------|
| `backend/app/models/` | ORM 模型 |
| `backend/app/db/session.py` | 引擎与会话 |
| `backend/app/db/migrate.py` | 启动迁移 |
| `backend/app/init_db.py` | 建表 + 种子 |
