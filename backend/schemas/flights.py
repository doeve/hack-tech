from datetime import datetime

from pydantic import BaseModel


class FlightOut(BaseModel):
    id: str
    airport_id: str
    flight_number: str
    airline_iata: str
    direction: str
    scheduled_at: datetime
    estimated_at: datetime | None = None
    actual_at: datetime | None = None
    gate_poi_id: str | None = None
    status: str
    baggage_belt: str | None = None

    model_config = {"from_attributes": True}


class FlightSubscriptionOut(BaseModel):
    subscription_id: str

    model_config = {"from_attributes": True}
