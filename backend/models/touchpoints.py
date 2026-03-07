import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID

from models import Base


class Touchpoint(Base):
    __tablename__ = "touchpoints"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    airport_id = Column(
        UUID(as_uuid=True), ForeignKey("airports.id"), nullable=False
    )
    poi_id = Column(UUID(as_uuid=True), ForeignKey("pois.id"))
    name = Column(Text, nullable=False)
    touchpoint_type = Column(Text, nullable=False)
    required_claims = Column(ARRAY(Text), nullable=False, default=[])
    required_assurance = Column(Text, nullable=False, default="ial2")
    is_active = Column(Boolean, nullable=False, default=True)


class VerificationEvent(Base):
    __tablename__ = "verification_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token_id = Column(
        UUID(as_uuid=True), ForeignKey("verification_tokens.id"), nullable=False
    )
    touchpoint_id = Column(
        UUID(as_uuid=True), ForeignKey("touchpoints.id"), nullable=False
    )
    outcome = Column(Text, nullable=False)
    failure_reason = Column(Text)
    match_score = Column(Float)
    occurred_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    device_id = Column(Text)
