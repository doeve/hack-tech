import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from models.notifications import NotificationQueue


async def enqueue(
    db: AsyncSession,
    user_id: str,
    channel: str = "push",
    title: str | None = None,
    body: str | None = None,
    payload: dict | None = None,
    priority: str = "normal",
    device_key: str | None = None,
    dedup_key: str | None = None,
) -> str | None:
    """Enqueue a notification for delivery by the push worker."""
    notif = NotificationQueue(
        id=uuid.uuid4(),
        user_id=user_id,
        device_key=device_key,
        channel=channel,
        title=title,
        body=body,
        payload=payload or {},
        priority=priority,
        status="pending",
        created_at=datetime.utcnow(),
        dedup_key=dedup_key,
    )
    db.add(notif)
    try:
        await db.commit()
        return str(notif.id)
    except Exception:
        await db.rollback()
        return None  # dedup conflict or other error
