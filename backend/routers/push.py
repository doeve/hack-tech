import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from config import settings
from database import get_db
from models.identity import User
from models.push import PushSubscription
from schemas.push import (
    PushSubscribeRequest,
    PushSubscribeResponse,
    PushTestRequest,
    PushUnsubscribeRequest,
    StatusResponse,
    VapidPublicKeyOut,
)
from services.notifications import enqueue

router = APIRouter()


@router.get("/push/vapid-public-key", response_model=VapidPublicKeyOut)
async def get_vapid_public_key():
    """Public endpoint — no auth required."""
    return VapidPublicKeyOut(public_key=settings.vapid_public_key)


@router.post("/push/subscribe", response_model=PushSubscribeResponse)
async def subscribe_push(
    body: PushSubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Upsert: check if subscription already exists for this user+endpoint
    stmt = select(PushSubscription).where(
        PushSubscription.user_id == current_user.id,
        PushSubscription.endpoint == body.endpoint,
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        # Update keys
        existing.p256dh_key = body.keys.get("p256dh", "")
        existing.auth_key = body.keys.get("auth", "")
        existing.device_key = body.device_key
        existing.subscribed_at = datetime.utcnow()
        await db.commit()
        return PushSubscribeResponse(subscription_id=str(existing.id))

    sub = PushSubscription(
        id=uuid.uuid4(),
        user_id=current_user.id,
        device_key=body.device_key,
        endpoint=body.endpoint,
        p256dh_key=body.keys.get("p256dh", ""),
        auth_key=body.keys.get("auth", ""),
        subscribed_at=datetime.utcnow(),
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)

    return PushSubscribeResponse(subscription_id=str(sub.id))


@router.delete("/push/unsubscribe", response_model=StatusResponse)
async def unsubscribe_push(
    body: PushUnsubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = delete(PushSubscription).where(
        PushSubscription.user_id == current_user.id,
        PushSubscription.endpoint == body.endpoint,
    )
    await db.execute(stmt)
    await db.commit()

    return StatusResponse(status="unsubscribed")


@router.post("/push/test", response_model=StatusResponse)
async def test_push(
    body: PushTestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    notif_id = await enqueue(
        db=db,
        user_id=str(current_user.id),
        channel="push",
        title=body.title,
        body=body.body,
        payload={"url": "/"},
    )

    if notif_id:
        return StatusResponse(status="queued")
    else:
        raise HTTPException(status_code=500, detail="Failed to queue notification")
