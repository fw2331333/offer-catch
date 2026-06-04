"""
轻量 SQL 迁移（不用 Alembic 时的折中方案）。

每条语句带 IF NOT EXISTS / IF NOT EXISTS 列，可重复执行；
适合小团队、字段增量不多。表结构大改时仍建议上 Alembic。
"""
from sqlalchemy import text

from app.db.session import engine


async def run_migrations() -> None:
    """在 main lifespan 与 init_db 中调用，保证旧数据卷升级后不 500。"""
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS source VARCHAR(30) DEFAULT 'seed'"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL"
            )
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_api_key TEXT")
        )
        await conn.execute(
            text("ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS source_url VARCHAR(500)")
        )
        await conn.execute(
            text(
                "ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE"
            )
        )
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_job_postings_is_shared ON job_postings (is_shared)"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE match_results ADD COLUMN IF NOT EXISTS analysis_status VARCHAR(20) DEFAULT 'pending'"
            )
        )
        await conn.execute(
            text("ALTER TABLE match_results ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0")
        )
        await conn.execute(
            text("ALTER TABLE match_results ALTER COLUMN overall_score DROP NOT NULL")
        )
        await conn.execute(
            text(
                "ALTER TABLE match_results ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()"
            )
        )
        await conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_match_results_user_job "
                "ON match_results (user_id, job_id)"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN "
                "DEFAULT FALSE"
            )
        )
        await conn.execute(
            text("UPDATE users SET email_verified = TRUE WHERE email = 'demo@student.edu'")
        )
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS email_verification_tokens (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    token_hash VARCHAR(64) NOT NULL UNIQUE,
                    expires_at TIMESTAMPTZ NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
                """
            )
        )
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_email_verification_tokens_user_id "
                "ON email_verification_tokens (user_id)"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE email_verification_tokens "
                "ADD COLUMN IF NOT EXISTS purpose VARCHAR(32) DEFAULT 'verify_email'"
            )
        )
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_email_verification_tokens_purpose "
                "ON email_verification_tokens (purpose)"
            )
        )
