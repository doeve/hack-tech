from datetime import datetime

from pydantic import BaseModel


class ReplayTrackOut(BaseModel):
    id: str
    airport_id: str
    name: str
    description: str | None = None
    total_steps: int | None = None
    duration_ms: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReplayStartRequest(BaseModel):
    session_id: str
    track_id: str
    speed_multiplier: float = 1.0


class ReplayStopResponse(BaseModel):
    status: str
