from pydantic import BaseModel


class AccessibilityProfileOut(BaseModel):
    id: str
    device_key: str
    nav_mode: str
    haptics_enabled: bool
    haptic_intensity: float
    tts_enabled: bool
    tts_speed: float
    tts_voice: str
    high_contrast: bool
    font_scale: float
    ar_enabled: bool
    avoid_stairs: bool
    avoid_escalators: bool
    extra_time_multiplier: float
    visual_impairment: str | None = None
    hearing_impairment: str | None = None
    mobility_impairment: str | None = None

    model_config = {"from_attributes": True}


class AccessibilityProfileUpdate(BaseModel):
    device_key: str | None = None
    nav_mode: str | None = None
    haptics_enabled: bool | None = None
    haptic_intensity: float | None = None
    tts_enabled: bool | None = None
    tts_speed: float | None = None
    tts_voice: str | None = None
    high_contrast: bool | None = None
    font_scale: float | None = None
    ar_enabled: bool | None = None
    avoid_stairs: bool | None = None
    avoid_escalators: bool | None = None
    extra_time_multiplier: float | None = None
    visual_impairment: str | None = None
    hearing_impairment: str | None = None
    mobility_impairment: str | None = None


class HapticPatternOut(BaseModel):
    id: str
    name: str
    description: str | None = None
    category: str
    duration_ms: int
    vibration_pattern: list[int]
    intensity: float

    model_config = {"from_attributes": True}


class AudioCueOut(BaseModel):
    id: str
    name: str
    description: str | None = None
    category: str
    tts_template: str | None = None
    language_code: str

    model_config = {"from_attributes": True}
