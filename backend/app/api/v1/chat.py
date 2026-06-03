import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.llm.errors import LLMServiceError
from app.llm.streaming import format_assistant_storage, sse_line
from app.models.chat import ChatMessage, ChatSession
from app.models.user import User
from app.schemas.chat import (
    ChatMessageResponse,
    ChatSendRequest,
    ChatSendResponse,
    ChatSessionCreate,
    ChatSessionResponse,
)
from app.services.agent import agent_reply, stream_agent_events

router = APIRouter(prefix="/chat", tags=["智能对话"])


@router.get("/sessions", response_model=list[ChatSessionResponse])
async def list_sessions(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChatSession).where(ChatSession.user_id == user.id).order_by(ChatSession.updated_at.desc())
    )
    return list(result.scalars().all())


@router.post("/sessions", response_model=ChatSessionResponse)
async def create_session(
    body: ChatSessionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = ChatSession(user_id=user.id, title=body.title, mode=body.mode)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageResponse])
async def get_messages(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(ChatSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(404, detail="会话不存在")
    result = await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc())
    )
    return list(result.scalars().all())


@router.post("/send", response_model=ChatSendResponse)
async def send_message(
    body: ChatSendRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.session_id:
        session = await db.get(ChatSession, body.session_id)
        if not session or session.user_id != user.id:
            raise HTTPException(404, detail="会话不存在")
    else:
        session = ChatSession(user_id=user.id, title=body.message[:30], mode=body.mode)
        db.add(session)
        await db.flush()

    session.mode = body.mode
    db.add(ChatMessage(session_id=session.id, role="user", content=body.message))

    try:
        reply = await agent_reply(
            db,
            user,
            session,
            body.message,
            mode=body.mode,
            deep_think=body.deep_think,
            smart_search=body.smart_search,
        )
    except LLMServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e
    db.add(ChatMessage(session_id=session.id, role="assistant", content=reply))
    await db.commit()

    result = await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == session.id).order_by(ChatMessage.created_at.asc())
    )
    messages = list(result.scalars().all())
    return ChatSendResponse(
        session_id=session.id,
        reply=reply,
        messages=[ChatMessageResponse.model_validate(m) for m in messages],
    )


async def _stream_chat_generator(
    body: ChatSendRequest,
    user: User,
    db: AsyncSession,
) -> AsyncIterator[str]:
    thinking_buf: list[str] = []
    content_buf: list[str] = []

    try:
        if body.session_id:
            session = await db.get(ChatSession, body.session_id)
            if not session or session.user_id != user.id:
                yield sse_line({"type": "error", "message": "会话不存在"})
                return
        else:
            session = ChatSession(user_id=user.id, title=body.message[:30], mode=body.mode)
            db.add(session)
            await db.flush()

        session.mode = body.mode
        db.add(ChatMessage(session_id=session.id, role="user", content=body.message))
        await db.commit()

        yield sse_line({"type": "session", "session_id": session.id})

        async for event in stream_agent_events(
            db,
            user,
            session,
            body.message,
            mode=body.mode,
            deep_think=body.deep_think,
            smart_search=body.smart_search,
        ):
            etype = event.get("type")
            delta = event.get("delta") or ""
            if etype == "thinking":
                thinking_buf.append(delta)
            elif etype == "content":
                content_buf.append(delta)
            yield sse_line(event)

        full_thinking = "".join(thinking_buf)
        full_content = "".join(content_buf)
        stored = format_assistant_storage(full_thinking, full_content)
        db.add(ChatMessage(session_id=session.id, role="assistant", content=stored))
        await db.commit()

        yield sse_line(
            {
                "type": "done",
                "session_id": session.id,
                "thinking": full_thinking,
                "content": full_content,
            }
        )
    except LLMServiceError as e:
        yield sse_line({"type": "error", "message": e.message})
    except Exception as e:
        yield sse_line({"type": "error", "message": f"对话失败：{e}"})


@router.post("/send/stream")
async def send_message_stream(
    body: ChatSendRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return StreamingResponse(
        _stream_chat_generator(body, user, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
