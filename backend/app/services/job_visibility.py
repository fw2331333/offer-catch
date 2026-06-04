"""岗位可见性：默认仅本人可见，主动共享后其他用户可见；系统 seed 岗位全员可见。"""

from fastapi import HTTPException
from sqlalchemy import and_, or_

from app.models.job import JobPosting


def job_visible_clause(user_id: int):
    return or_(
        JobPosting.source == "seed",
        JobPosting.created_by_user_id == user_id,
        and_(
            JobPosting.is_shared.is_(True),
            JobPosting.created_by_user_id.isnot(None),
            JobPosting.created_by_user_id != user_id,
        ),
    )


def job_visible_to_user(job: JobPosting, user_id: int) -> bool:
    if job.source == "seed":
        return True
    if job.created_by_user_id == user_id:
        return True
    if (
        job.is_shared
        and job.created_by_user_id is not None
        and job.created_by_user_id != user_id
    ):
        return True
    return False


def assert_job_visible(job: JobPosting | None, user_id: int) -> JobPosting:
    if not job:
        raise HTTPException(status_code=404, detail="岗位不存在")
    if not job_visible_to_user(job, user_id):
        raise HTTPException(status_code=404, detail="岗位不存在或无权访问")
    return job
