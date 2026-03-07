import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from models import Base


class NotificationQueue(Base):
    __tablename__ = "notification_queue"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    device_key = Column(Text)
    channel = Column(Text, nullable=False)
    haptic_pattern_id = Column(UUID(as_uuid=True), ForeignKey("haptic_patterns.id"))
    audio_cue_id = Column(UUID(as_uuid=True), ForeignKey("audio_cues.id"))
    title = Column(Text)
    body = Column(Text)
    payload = Column(JSONB, nullable=False, default={})
    priority = Column(Text, nullable=False, default="normal")
    status = Column(Text, nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    sent_at = Column(DateTime(timezone=True))
    failure_reason = Column(Text)
    dedup_key = Column(Text)
