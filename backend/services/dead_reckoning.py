import math
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.navigation import NavNode

GRAVITY = 9.81
STEP_THRESHOLD_MULTIPLIER = 1.2
MIN_STEP_INTERVAL_MS = 300
DRIFT_RATE = 0.03
MAP_MATCH_RADIUS_M = 3.0
DRIFT_RESET_ON_SNAP = 0.3


def accel_magnitude(ax: float, ay: float, az: float) -> float:
    return math.sqrt(ax**2 + ay**2 + az**2)


def detect_steps(readings: list[dict]) -> list[dict]:
    """
    Zero-crossing peak detection on |accel|.
    Threshold = STEP_THRESHOLD_MULTIPLIER * GRAVITY.
    Debounce: ignore peaks within MIN_STEP_INTERVAL_MS of last step.
    Returns subset of readings where a step peak was detected.
    """
    threshold = STEP_THRESHOLD_MULTIPLIER * GRAVITY
    steps = []
    last_step_ms = -MIN_STEP_INTERVAL_MS  # allow first step immediately
    prev_mag = 0.0
    prev_prev_mag = 0.0

    for i, r in enumerate(readings):
        ax = r.get("accel_x", 0) or 0
        ay = r.get("accel_y", 0) or 0
        az = r.get("accel_z", 0) or 0
        mag = accel_magnitude(ax, ay, az)

        # Peak detection: previous value was a local maximum above threshold
        if i >= 2 and prev_mag > threshold and prev_mag >= mag and prev_mag >= prev_prev_mag:
            # Estimate time from recorded_at or use index-based approximation
            recorded_at = r.get("recorded_at")
            if recorded_at and hasattr(recorded_at, "timestamp"):
                current_ms = recorded_at.timestamp() * 1000
            else:
                current_ms = i * 100  # fallback: assume ~100ms cadence

            if current_ms - last_step_ms >= MIN_STEP_INTERVAL_MS:
                steps.append(readings[i - 1])
                last_step_ms = current_ms

        prev_prev_mag = prev_mag
        prev_mag = mag

    return steps


def dr_step(
    x: float, y: float, heading_deg: float, stride_m: float, drift: float
) -> tuple[float, float, float]:
    """
    Advance position by one step.
    x += stride_m * sin(radians(heading_deg))
    y += stride_m * cos(radians(heading_deg))
    drift += stride_m * DRIFT_RATE
    """
    rad = math.radians(heading_deg)
    new_x = x + stride_m * math.sin(rad)
    new_y = y + stride_m * math.cos(rad)
    new_drift = drift + stride_m * DRIFT_RATE
    return new_x, new_y, new_drift


def estimate_stride(cadence_spm: Optional[float] = None) -> float:
    """Weinberg model. Default 0.75 m. Scales with cadence."""
    if cadence_spm is None or cadence_spm <= 0:
        return 0.75
    # Weinberg approximation: stride ~ 0.4 + 0.005 * cadence
    stride = 0.4 + 0.005 * cadence_spm
    # Clamp to reasonable range
    return max(0.5, min(stride, 1.2))


async def map_match(
    x: float, y: float, airport_id: str, db: AsyncSession
) -> tuple[float, float, float, Optional[str]]:
    """
    Find nearest nav_node within MAP_MATCH_RADIUS_M.
    If found: return (node.x_m, node.y_m, DRIFT_RESET_ON_SNAP, node.id).
    If not:   return (x, y, drift_unchanged, None).
    Note: drift_unchanged is not known here, so we return -1 as a sentinel
    and the caller must handle it.
    """
    stmt = select(NavNode).where(NavNode.airport_id == airport_id)
    result = await db.execute(stmt)
    nodes = result.scalars().all()

    best_node = None
    best_dist = MAP_MATCH_RADIUS_M

    for node in nodes:
        dist = math.sqrt((node.x_m - x) ** 2 + (node.y_m - y) ** 2)
        if dist < best_dist:
            best_dist = dist
            best_node = node

    if best_node is not None:
        return (
            best_node.x_m,
            best_node.y_m,
            DRIFT_RESET_ON_SNAP,
            str(best_node.id),
        )
    else:
        return x, y, -1.0, None  # -1 sentinel: caller keeps current drift
