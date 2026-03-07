from datetime import datetime

from pydantic import BaseModel


class SessionCreateRequest(BaseModel):
    airport_id: str
    start_x_m: float
    start_y_m: float
    start_confirmed_by: str = "manual"
    destination_poi_id: str | None = None
    route_mode: str = "fastest"
    nav_mode: str = "standard"
    ar_enabled: bool = True
    replay_track_id: str | None = None


class SessionOut(BaseModel):
    id: str
    user_id: str | None = None
    airport_id: str
    start_x_m: float
    start_y_m: float
    start_confirmed_by: str
    destination_poi_id: str | None = None
    route_mode: str
    nav_mode: str
    ar_enabled: bool
    status: str
    started_at: datetime
    ended_at: datetime | None = None
    replay_track_id: str | None = None
    total_distance_m: float | None = None
    total_steps: int | None = None
    max_drift_m: float | None = None

    model_config = {"from_attributes": True}


class SessionUpdateRequest(BaseModel):
    status: str  # completed | abandoned


class PositionOut(BaseModel):
    x_m: float
    y_m: float
    heading_deg: float
    drift_radius_m: float
    map_matched: bool = False
    snapped_node_id: str | None = None
    source: str = "dead_reckoning"

    model_config = {"from_attributes": True}


class SessionWithPositionOut(BaseModel):
    session: SessionOut
    latest_position: PositionOut | None = None
