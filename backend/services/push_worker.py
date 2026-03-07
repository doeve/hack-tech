import asyncio
import json
import logging
from datetime import datetime

from sqlalchemy import select, update

from config import settings
from models.notifications import NotificationQueue
from models.push import PushSubscription

logger = logging.getLogger("push_worker")

POLL_INTERVAL_S = 30  # check for pending notifications every 30 s
# TODO(prod): Use Celery + Redis for reliable delivery instead of polling.


async def run_push_worker(db_factory):
    """
    Background loop. Started in main.py lifespan alongside the app.
    Each cycle:
      1. SELECT pending push notifications from notification_queue.
      2. For each: look up push_subscriptions row for the user/device.
      3. Call pywebpush.webpush() with VAPID credentials.
      4. UPDATE notification_queue.status = 'sent' | 'failed'.
    """
    while True:
        try:
            async with db_factory() as db:
                await dispatch_pending(db)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Push worker error: {e}")
        await asyncio.sleep(POLL_INTERVAL_S)


async def dispatch_pending(db):
    """Fetch up to 50 pending push notifications and dispatch them."""
    stmt = (
        select(NotificationQueue)
        .where(NotificationQueue.status == "pending")
        .where(NotificationQueue.channel == "push")
        .order_by(NotificationQueue.created_at)
        .limit(50)
    )
    result = await db.execute(stmt)
    pending = result.scalars().all()

    for notif in pending:
        # Find matching push subscription
        sub_stmt = select(PushSubscription).where(
            PushSubscription.user_id == notif.user_id
        )
        if notif.device_key:
            sub_stmt = sub_stmt.where(PushSubscription.device_key == notif.device_key)
        sub_stmt = sub_stmt.limit(1)

        sub_result = await db.execute(sub_stmt)
        subscription = sub_result.scalar_one_or_none()

        if not subscription:
            await db.execute(
                update(NotificationQueue)
                .where(NotificationQueue.id == notif.id)
                .values(
                    status="failed",
                    failure_reason="no_push_subscription",
                    sent_at=datetime.utcnow(),
                )
            )
            await db.commit()
            continue

        try:
            # Import here to avoid import error if pywebpush is not configured
            from pywebpush import WebPushException, webpush

            push_data = json.dumps(
                {
                    "title": notif.title or "Airport Companion",
                    "body": notif.body or "",
                    "url": (notif.payload or {}).get("url", "/"),
                }
            )

            webpush(
                subscription_info={
                    "endpoint": subscription.endpoint,
                    "keys": {
                        "p256dh": subscription.p256dh_key,
                        "auth": subscription.auth_key,
                    },
                },
                data=push_data,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={
                    "sub": f"mailto:{settings.vapid_contact_email}"
                },
            )

            await db.execute(
                update(NotificationQueue)
                .where(NotificationQueue.id == notif.id)
                .values(status="sent", sent_at=datetime.utcnow())
            )
            await db.commit()

        except Exception as e:
            error_msg = str(e)
            await db.execute(
                update(NotificationQueue)
                .where(NotificationQueue.id == notif.id)
                .values(status="failed", failure_reason=error_msg)
            )
            await db.commit()

            # If HTTP 410 Gone: delete the stale subscription row
            # TODO(prod): More robust error handling for WebPushException
            if "410" in error_msg:
                from sqlalchemy import delete as sa_delete

                await db.execute(
                    sa_delete(PushSubscription).where(
                        PushSubscription.id == subscription.id
                    )
                )
                await db.commit()
