from datetime import datetime

from pydantic import BaseModel


class ImuReadingIn(BaseModel):
    accel_x: float | None = None
    accel_y: float | None = None
    accel_z: float | None = None
    gyro_x: float | None = None
    gyro_y: float | None = None
    gyro_z: float | None = None
    mag_x: float | None = None
    mag_y: float | None = None
    mag_z: float | None = None
    quat_w: float | None = None
    quat_x: float | None = None
    quat_y: float | None = None
    quat_z: float | None = None
    heading_deg: float | None = None
    recorded_at: datetime | None = None


class ImuBatchRequest(BaseModel):
    readings: list[ImuReadingIn]


class ImuBatchResponse(BaseModel):
    steps_detected: int
    latest_position: dict | None = None


class StepRequest(BaseModel):
    heading_deg: float
    stride_length_m: float | None = None
    cadence_spm: float | None = None


class StepResponse(BaseModel):
    x_m: float
    y_m: float
    heading_deg: float
    drift_radius_m: float
    map_matched: bool
    snapped_node_id: str | None = None
