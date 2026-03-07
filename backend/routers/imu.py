import math
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models.dead_reckoning import DrSession, ImuReading, PositionEstimate, StepEvent
from models.identity import User
from schemas.imu import ImuBatchRequest, ImuBatchResponse, StepRequest, StepResponse
from services.dead_reckoning import (
    detect_steps,
    dr_step,
    estimate_stride,
    map_match,
)

router = APIRouter()


@router.post("/sessions/{session_id}/imu", response_model=ImuBatchResponse)
async def post_imu_batch(
    session_id: str,
    body: ImuBatchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(DrSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "active":
        raise HTTPException(status_code=400, detail="Session is not active")

    # Store IMU readings
    for r in body.readings:
        reading = ImuReading(
            session_id=session_id,
            accel_x=r.accel_x,
            accel_y=r.accel_y,
            accel_z=r.accel_z,
            gyro_x=r.gyro_x,
            gyro_y=r.gyro_y,
            gyro_z=r.gyro_z,
            mag_x=r.mag_x,
            mag_y=r.mag_y,
            mag_z=r.mag_z,
            quat_w=r.quat_w,
            quat_x=r.quat_x,
            quat_y=r.quat_y,
            quat_z=r.quat_z,
            heading_deg=r.heading_deg,
            recorded_at=r.recorded_at or datetime.utcnow(),
        )
        db.add(reading)

    # Detect steps from the batch
    readings_dicts = [r.model_dump() for r in body.readings]
    step_readings = detect_steps(readings_dicts)

    # Get current position
    pos_stmt = (
        select(PositionEstimate)
        .where(PositionEstimate.session_id == session_id)
        .order_by(PositionEstimate.estimated_at.desc())
        .limit(1)
    )
    pos_result = await db.execute(pos_stmt)
    latest_pos = pos_result.scalar_one_or_none()

    x = latest_pos.x_m if latest_pos else session.start_x_m
    y = latest_pos.y_m if latest_pos else session.start_y_m
    heading = latest_pos.heading_deg if latest_pos else 0.0
    drift = latest_pos.drift_radius_m if latest_pos else 0.0

    # Get current step count
    step_count_stmt = select(func.count()).select_from(StepEvent).where(
        StepEvent.session_id == session_id
    )
    step_count_result = await db.execute(step_count_stmt)
    current_step = step_count_result.scalar() or 0

    latest_position = None

    for sr in step_readings:
        step_heading = sr.get("heading_deg", heading) or heading
        stride = estimate_stride()
        new_x, new_y, new_drift = dr_step(x, y, step_heading, stride, drift)

        current_step += 1
        delta_x = stride * math.sin(math.radians(step_heading))
        delta_y = stride * math.cos(math.radians(step_heading))

        step_event = StepEvent(
            session_id=session_id,
            heading_deg=step_heading,
            stride_length_m=stride,
            delta_x_m=delta_x,
            delta_y_m=delta_y,
            step_number=current_step,
            detected_at=datetime.utcnow(),
        )
        db.add(step_event)

        # Map match
        matched_x, matched_y, matched_drift, snapped_id = await map_match(
            new_x, new_y, str(session.airport_id), db
        )
        is_matched = snapped_id is not None
        final_drift = matched_drift if matched_drift >= 0 else new_drift

        pos = PositionEstimate(
            session_id=session_id,
            x_m=matched_x,
            y_m=matched_y,
            heading_deg=step_heading,
            drift_radius_m=final_drift,
            map_matched=is_matched,
            snapped_node_id=snapped_id,
            source="map_matched" if is_matched else "dead_reckoning",
            estimated_at=datetime.utcnow(),
        )
        db.add(pos)

        x, y, heading, drift = matched_x, matched_y, step_heading, final_drift
        latest_position = {
            "x_m": x,
            "y_m": y,
            "heading_deg": heading,
            "drift_radius_m": drift,
            "map_matched": is_matched,
        }

    await db.commit()

    return ImuBatchResponse(
        steps_detected=len(step_readings),
        latest_position=latest_position,
    )


@router.post("/sessions/{session_id}/steps", response_model=StepResponse)
async def post_step(
    session_id: str,
    body: StepRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(DrSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "active":
        raise HTTPException(status_code=400, detail="Session is not active")

    # Get current position
    pos_stmt = (
        select(PositionEstimate)
        .where(PositionEstimate.session_id == session_id)
        .order_by(PositionEstimate.estimated_at.desc())
        .limit(1)
    )
    pos_result = await db.execute(pos_stmt)
    latest_pos = pos_result.scalar_one_or_none()

    x = latest_pos.x_m if latest_pos else session.start_x_m
    y = latest_pos.y_m if latest_pos else session.start_y_m
    drift = latest_pos.drift_radius_m if latest_pos else 0.0

    stride = body.stride_length_m or estimate_stride(body.cadence_spm)
    new_x, new_y, new_drift = dr_step(x, y, body.heading_deg, stride, drift)

    # Step count
    step_count_stmt = select(func.count()).select_from(StepEvent).where(
        StepEvent.session_id == session_id
    )
    step_count_result = await db.execute(step_count_stmt)
    current_step = (step_count_result.scalar() or 0) + 1

    delta_x = stride * math.sin(math.radians(body.heading_deg))
    delta_y = stride * math.cos(math.radians(body.heading_deg))

    step_event = StepEvent(
        session_id=session_id,
        heading_deg=body.heading_deg,
        stride_length_m=stride,
        delta_x_m=delta_x,
        delta_y_m=delta_y,
        step_number=current_step,
        cadence_spm=body.cadence_spm,
        detected_at=datetime.utcnow(),
    )
    db.add(step_event)

    # Map match
    matched_x, matched_y, matched_drift, snapped_id = await map_match(
        new_x, new_y, str(session.airport_id), db
    )
    is_matched = snapped_id is not None
    final_drift = matched_drift if matched_drift >= 0 else new_drift

    pos = PositionEstimate(
        session_id=session_id,
        x_m=matched_x,
        y_m=matched_y,
        heading_deg=body.heading_deg,
        drift_radius_m=final_drift,
        map_matched=is_matched,
        snapped_node_id=snapped_id,
        source="map_matched" if is_matched else "dead_reckoning",
        estimated_at=datetime.utcnow(),
    )
    db.add(pos)

    await db.commit()

    return StepResponse(
        x_m=matched_x,
        y_m=matched_y,
        heading_deg=body.heading_deg,
        drift_radius_m=final_drift,
        map_matched=is_matched,
        snapped_node_id=snapped_id,
    )
