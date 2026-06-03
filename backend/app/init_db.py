import asyncio

from sqlalchemy import select

from app.db.migrate import run_migrations
from app.db.session import Base, async_session, engine
from app.models.job import JobPosting as JobModel
from app.models.user import StudentProfile, User
from app.core.security import hash_password

SEED_JOBS = [
    {
        "company": "字节跳动",
        "title": "数据分析实习生",
        "city": "北京",
        "job_type": "实习",
        "salary_min": 200,
        "salary_max": 350,
        "industry": "互联网",
        "tags": ["Python", "SQL", "数据分析"],
        "description": "负责业务数据提取、清洗与可视化；协助 A/B 实验分析；产出周报与洞察。",
        "requirements": {
            "required_skills": ["Python", "SQL", "Excel"],
            "preferred_skills": ["Tableau", "统计学"],
            "education": "本科及以上",
        },
    },
    {
        "company": "阿里巴巴",
        "title": "Java 开发实习生",
        "city": "杭州",
        "job_type": "实习",
        "salary_min": 250,
        "salary_max": 400,
        "industry": "互联网",
        "tags": ["Java", "Spring", "微服务"],
        "description": "参与电商核心链路开发与维护；编写单元测试；配合 Code Review。",
        "requirements": {
            "required_skills": ["Java", "数据结构", "计算机网络"],
            "preferred_skills": ["Spring Boot", "MySQL", "Redis"],
            "education": "本科及以上",
        },
    },
    {
        "company": "腾讯",
        "title": "产品经理实习生",
        "city": "深圳",
        "job_type": "实习",
        "salary_min": 180,
        "salary_max": 300,
        "industry": "互联网",
        "tags": ["产品", "需求分析", "用户研究"],
        "description": "协助需求调研与原型设计；跟进开发与测试；分析用户反馈与数据。",
        "requirements": {
            "required_skills": ["Axure/Figma", "逻辑思维", "沟通能力"],
            "preferred_skills": ["SQL", "竞品分析"],
            "education": "本科及以上",
        },
    },
    {
        "company": "美团",
        "title": "前端开发实习生",
        "city": "北京",
        "job_type": "实习",
        "salary_min": 220,
        "salary_max": 380,
        "industry": "互联网",
        "tags": ["React", "TypeScript", "前端"],
        "description": "参与本地生活业务前端开发；组件库维护；性能优化。",
        "requirements": {
            "required_skills": ["JavaScript", "HTML/CSS", "React 或 Vue"],
            "preferred_skills": ["TypeScript", "Webpack/Vite"],
            "education": "本科及以上",
        },
    },
    {
        "company": "华为",
        "title": "嵌入式软件工程师（校招）",
        "city": "深圳",
        "job_type": "校招",
        "salary_min": 15000,
        "salary_max": 25000,
        "industry": "通信",
        "tags": ["C/C++", "嵌入式", "RTOS"],
        "description": "从事通信设备嵌入式软件开发与调试；参与模块设计与联调。",
        "requirements": {
            "required_skills": ["C/C++", "操作系统", "计算机基础"],
            "preferred_skills": ["RTOS", "驱动开发"],
            "education": "硕士优先，本科优秀亦可",
        },
    },
    {
        "company": "招商银行",
        "title": "金融科技管培生",
        "city": "上海",
        "job_type": "校招",
        "salary_min": 12000,
        "salary_max": 18000,
        "industry": "金融",
        "tags": ["金融", "数据分析", "风控"],
        "description": "轮岗学习零售/对公业务系统；参与风控模型与数据平台建设。",
        "requirements": {
            "required_skills": ["金融学基础", "数据分析", "英语"],
            "preferred_skills": ["Python", "SQL", "CFA/FRM"],
            "education": "本科及以上",
        },
    },
    {
        "company": "米哈游",
        "title": "游戏客户端开发实习生",
        "city": "上海",
        "job_type": "实习",
        "salary_min": 300,
        "salary_max": 500,
        "industry": "游戏",
        "tags": ["Unity", "C#", "游戏"],
        "description": "参与游戏客户端功能开发；性能 profiling；与策划美术协作。",
        "requirements": {
            "required_skills": ["C# 或 C++", "Unity 或 Unreal 了解"],
            "preferred_skills": ["图形学基础", "热更新"],
            "education": "本科及以上",
        },
    },
    {
        "company": "拼多多",
        "title": "算法实习生（推荐）",
        "city": "上海",
        "job_type": "实习",
        "salary_min": 350,
        "salary_max": 600,
        "industry": "互联网",
        "tags": ["机器学习", "Python", "推荐系统"],
        "description": "参与推荐/搜索模型迭代；特征工程；离线评估与线上实验分析。",
        "requirements": {
            "required_skills": ["Python", "机器学习", "深度学习基础"],
            "preferred_skills": ["PyTorch", "推荐系统", "论文阅读"],
            "education": "硕士优先",
        },
    },
    {
        "company": "比亚迪",
        "title": "电池系统工程师（校招）",
        "city": "深圳",
        "job_type": "校招",
        "salary_min": 10000,
        "salary_max": 16000,
        "industry": "新能源",
        "tags": ["新能源", "电池", "材料"],
        "description": "动力电池系统设计与测试；参与 BMS 相关需求分析。",
        "requirements": {
            "required_skills": ["电化学/材料/车辆相关专业", "MATLAB"],
            "preferred_skills": ["BMS", "CAE"],
            "education": "本科及以上",
        },
    },
    {
        "company": "小红书",
        "title": "内容运营实习生",
        "city": "上海",
        "job_type": "实习",
        "salary_min": 150,
        "salary_max": 250,
        "industry": "互联网",
        "tags": ["运营", "内容", "社区"],
        "description": "策划社区活动；分析内容数据；协助 KOL 合作与复盘。",
        "requirements": {
            "required_skills": ["文案", "数据分析意识", "小红书重度用户"],
            "preferred_skills": ["Photoshop", "短视频"],
            "education": "本科及以上",
        },
    },
]


async def init() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await run_migrations()

    async with async_session() as db:
        count = await db.execute(select(JobModel).limit(1))
        if count.scalar_one_or_none() is None:
            for j in SEED_JOBS:
                db.add(JobModel(**j))
            await db.commit()
            print(f"Seeded {len(SEED_JOBS)} jobs")
        else:
            print("Jobs already seeded")

        demo = await db.execute(select(User).where(User.email == "demo@student.edu"))
        if demo.scalar_one_or_none() is None:
            user = User(
                email="demo@student.edu",
                username="演示同学",
                hashed_password=hash_password("demo1234"),
                email_verified=True,
            )
            db.add(user)
            await db.flush()
            db.add(
                StudentProfile(
                    user_id=user.id,
                    target_cities=["北京", "上海"],
                    target_roles=["数据分析", "产品"],
                    industries=["互联网"],
                    job_type="实习",
                )
            )
            await db.commit()
            print("Demo user: demo@student.edu / demo1234")


if __name__ == "__main__":
    asyncio.run(init())
