import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID

from models import Base


class ReplayTrack(Base):
    __tablename__ = "replay_tracks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    airport_id = Column(
        UUID(as_uuid=True), ForeignKey("airports.id"), nullable=False
    )
    name = Column(Text, nullable=False)
    description = Column(Text)
    track_data = Column(JSONB, nullable=False)
    total_steps = Column(Integer)
    duration_ms = Column(Integer)
    poi_sequence = Column(ARRAY(UUID(as_uuid=True)))
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
