from pydantic import BaseModel


class AirportOut(BaseModel):
    id: str
    iata_code: str
    name: str
    floor_plan_url: str
    px_per_metre: float
    width_m: float
    height_m: float

    model_config = {"from_attributes": True}


class PoiOut(BaseModel):
    poi_id: str
    name: str
    category: str
    gate_number: str | None = None
    x_m: float
    y_m: float
    is_accessible: bool
    tts_label: str | None = None

    model_config = {"from_attributes": True}


class NavNodeOut(BaseModel):
    id: str
    x_m: float
    y_m: float
    node_type: str
    poi_id: str | None = None

    model_config = {"from_attributes": True}


class NavEdgeOut(BaseModel):
    id: str
    from_node_id: str
    to_node_id: str
    distance_m: float
    edge_type: str
    is_accessible: bool

    model_config = {"from_attributes": True}


class NavGraphOut(BaseModel):
    nodes: list[NavNodeOut]
    edges: list[NavEdgeOut]
