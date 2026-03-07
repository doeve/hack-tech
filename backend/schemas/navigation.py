from pydantic import BaseModel


class RouteRequest(BaseModel):
    airport_id: str
    from_node_id: str
    to_node_id: str
    mode: str = "fastest"  # fastest | accessible | least_crowded


class InstructionOut(BaseModel):
    step_index: int
    instruction_type: str
    distance_m: float
    bearing_deg: float
    display_text: str
    tts_text: str
    haptic_cue: str


class RouteResponse(BaseModel):
    node_sequence: list[str]
    total_distance_m: float
    total_time_s: float
    instructions: list[InstructionOut]
