import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from models import Base


class Flight(Base):
    __tablename__ = "flights"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    airport_id = Column(
        UUID(as_uuid=True), ForeignKey("airports.id"), nullable=False
    )
    flight_number = Column(Text, nullable=False)
    airline_iata = Column(Text, nullable=False)
    direction = Column(Text, nullable=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    estimated_at = Column(DateTime(timezone=True))
    actual_at = Column(DateTime(timezone=True))
    gate_poi_id = Column(UUID(as_uuid=True), ForeignKey("pois.id"))
    status = Column(Text, nullable=False, default="scheduled")
    baggage_belt = Column(Text)
    raw_source = Column(JSONB)
    synced_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    gate_poi = relationship("Poi")


class FlightSubscription(Base):
    __tablename__ = "flight_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    flight_id = Column(
        UUID(as_uuid=True), ForeignKey("flights.id", ondelete="CASCADE"), nullable=False
    )
    subscribed_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    notify_boarding = Column(Boolean, nullable=False, default=True)
    notify_gate_change = Column(Boolean, nullable=False, default=True)
    notify_delay = Column(Boolean, nullable=False, default=True)
