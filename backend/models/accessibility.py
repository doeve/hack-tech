import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, SmallInteger, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID

from models import Base


class AccessibilityProfile(Base):
    __tablename__ = "accessibility_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_key = Column(Text, nullable=False, unique=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    visual_impairment = Column(Text)
    hearing_impairment = Column(Text)
    mobility_impairment = Column(Text)
    nav_mode = Column(Text, nullable=False, default="standard")
    haptics_enabled = Column(Boolean, nullable=False, default=True)
    haptic_intensity = Column(Float, nullable=False, default=1.0)
    tts_enabled = Column(Boolean, nullable=False, default=False)
    tts_speed = Column(Float, nullable=False, default=1.0)
    tts_voice = Column(Text, nullable=False, default="default")
    high_contrast = Column(Boolean, nullable=False, default=False)
    font_scale = Column(Float, nullable=False, default=1.0)
    ar_enabled = Column(Boolean, nullable=False, default=True)
    avoid_stairs = Column(Boolean, nullable=False, default=False)
    avoid_escalators = Column(Boolean, nullable=False, default=False)
    extra_time_multiplier = Column(Float, nullable=False, default=1.0)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class HapticPattern(Base):
    __tablename__ = "haptic_patterns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False, unique=True)
    description = Column(Text)
    category = Column(Text, nullable=False)
    duration_ms = Column(SmallInteger, nullable=False)
    vibration_pattern = Column(ARRAY(Integer), nullable=False)
    ahap_payload = Column(JSONB)
    android_payload = Column(JSONB)
    intensity = Column(Float, nullable=False, default=1.0)


class AudioCue(Base):
    __tablename__ = "audio_cues"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False, unique=True)
    description = Column(Text)
    category = Column(Text, nullable=False)
    audio_url = Column(Text)
    tts_template = Column(Text)
    duration_ms = Column(SmallInteger)
    language_code = Column(Text, nullable=False, default="en")
