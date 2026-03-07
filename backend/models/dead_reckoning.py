import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID

from models import Base


class DrSession(Base):
    __tablename__ = "dr_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    device_key = Column(Text, nullable=False)
    airport_id = Column(
        UUID(as_uuid=True), ForeignKey("airports.id"), nullable=False
    )
    start_x_m = Column(Float, nullable=False)
    start_y_m = Column(Float, nullable=False)
    start_confirmed_by = Column(Text, nullable=False, default="manual")
    destination_poi_id = Column(UUID(as_uuid=True), ForeignKey("pois.id"))
    destination_node_id = Column(UUID(as_uuid=True), ForeignKey("nav_nodes.id"))
    route_mode = Column(Text, nullable=False, default="fastest")
    nav_mode = Column(Text, nullable=False, default="standard")
    ar_enabled = Column(Boolean, nullable=False, default=True)
    status = Column(Text, nullable=False, default="active")
    started_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    ended_at = Column(DateTime(timezone=True))
    replay_track_id = Column(UUID(as_uuid=True), ForeignKey("replay_tracks.id"))
    total_distance_m = Column(Float)
    total_steps = Column(Integer)
    max_drift_m = Column(Float)


class ImuReading(Base):
    __tablename__ = "imu_readings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(
        UUID(as_uuid=True), ForeignKey("dr_sessions.id", ondelete="CASCADE"), nullable=False
    )
    recorded_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    accel_x = Column(Float)
    accel_y = Column(Float)
    accel_z = Column(Float)
    gyro_x = Column(Float)
    gyro_y = Column(Float)
    gyro_z = Column(Float)
    mag_x = Column(Float)
    mag_y = Column(Float)
    mag_z = Column(Float)
    quat_w = Column(Float)
    quat_x = Column(Float)
    quat_y = Column(Float)
    quat_z = Column(Float)
    heading_deg = Column(Float)


class StepEvent(Base):
    __tablename__ = "step_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(
        UUID(as_uuid=True), ForeignKey("dr_sessions.id", ondelete="CASCADE"), nullable=False
    )
    detected_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    heading_deg = Column(Float, nullable=False)
    stride_length_m = Column(Float, nullable=False, default=0.75)
    delta_x_m = Column(Float, nullable=False)
    delta_y_m = Column(Float, nullable=False)
    step_number = Column(Integer, nullable=False)
    cadence_spm = Column(Float)
    activity = Column(Text)


class PositionEstimate(Base):
    __tablename__ = "position_estimates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(
        UUID(as_uuid=True), ForeignKey("dr_sessions.id", ondelete="CASCADE"), nullable=False
    )
    estimated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    x_m = Column(Float, nullable=False)
    y_m = Column(Float, nullable=False)
    heading_deg = Column(Float, nullable=False)
    drift_radius_m = Column(Float, nullable=False, default=0.0)
    map_matched = Column(Boolean, nullable=False, default=False)
    snapped_node_id = Column(UUID(as_uuid=True), ForeignKey("nav_nodes.id"))
    source = Column(Text, nullable=False, default="dead_reckoning")
