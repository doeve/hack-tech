import uuid

from sqlalchemy import (
    Boolean,
    Column,
    Float,
    ForeignKey,
    Integer,
    SmallInteger,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import relationship

from models import Base


class Airport(Base):
    __tablename__ = "airports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    iata_code = Column(Text, nullable=False, unique=True)
    icao_code = Column(Text, unique=True)
    name = Column(Text, nullable=False)
    city = Column(Text, nullable=False)
    country_code = Column(Text, nullable=False)
    timezone = Column(Text, nullable=False, default="UTC")
    floor_plan_url = Column(Text, nullable=False, default="/assets/floorplan.svg")
    px_per_metre = Column(Float, nullable=False, default=10)
    width_m = Column(Float, nullable=False, default=400)
    height_m = Column(Float, nullable=False, default=200)
    metadata_ = Column("metadata", JSONB, nullable=False, default={})

    zones = relationship("Zone", back_populates="airport", cascade="all, delete-orphan")
    pois = relationship("Poi", back_populates="airport", cascade="all, delete-orphan")


class Zone(Base):
    __tablename__ = "zones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    airport_id = Column(
        UUID(as_uuid=True), ForeignKey("airports.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(Text, nullable=False)
    zone_type = Column(Text, nullable=False)
    x_min_m = Column(Float, nullable=False)
    y_min_m = Column(Float, nullable=False)
    x_max_m = Column(Float, nullable=False)
    y_max_m = Column(Float, nullable=False)
    is_accessible = Column(Boolean, nullable=False, default=True)

    airport = relationship("Airport", back_populates="zones")


class PoiCategory(Base):
    __tablename__ = "poi_categories"

    id = Column(SmallInteger, primary_key=True, autoincrement=True)
    slug = Column(Text, nullable=False, unique=True)
    label = Column(Text, nullable=False)
    icon = Column(Text)


class Poi(Base):
    __tablename__ = "pois"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    airport_id = Column(
        UUID(as_uuid=True), ForeignKey("airports.id", ondelete="CASCADE"), nullable=False
    )
    zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id"))
    category_id = Column(SmallInteger, ForeignKey("poi_categories.id"), nullable=False)
    name = Column(Text, nullable=False)
    description = Column(Text)
    x_m = Column(Float, nullable=False)
    y_m = Column(Float, nullable=False)
    entrance_x_m = Column(Float)
    entrance_y_m = Column(Float)
    gate_number = Column(Text)
    airline_codes = Column(ARRAY(Text))
    is_accessible = Column(Boolean, nullable=False, default=True)
    has_tactile_path = Column(Boolean, nullable=False, default=False)
    has_hearing_loop = Column(Boolean, nullable=False, default=False)
    has_braille_signage = Column(Boolean, nullable=False, default=False)
    tts_label = Column(Text)
    haptic_cue = Column(Text)
    operating_hours = Column(JSONB)
    is_active = Column(Boolean, nullable=False, default=True)
    updated_at = Column(Text)  # handled by DB default

    airport = relationship("Airport", back_populates="pois")
    category = relationship("PoiCategory")
