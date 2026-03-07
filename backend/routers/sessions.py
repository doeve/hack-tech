import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models.dead_reckoning import DrSession, PositionEstimate
from models.identity import User
from schemas.session import (
    PositionOut,
    SessionCreateRequest,
    SessionOut,
    SessionUpdateRequest,
    SessionWithPositionOut,
)

router = APIRouter()


@router.post("/sessions", response_model=SessionOut)
async def create_session(
    body: SessionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = DrSession(
        id=uuid.uuid4(),
        user_id=current_user.id,
        device_key="web",
        airport_id=body.airport_id,
        start_x_m=body.start_x_m,
        start_y_m=body.start_y_m,
        start_confirmed_by=body.start_confirmed_by,
        destination_poi_id=body.destination_poi_id,
        route_mode=body.route_mode,
        nav_mode=body.nav_mode,
        ar_enabled=body.ar_enabled,
        replay_track_id=body.replay_track_id,
        status="active",
        started_at=datetime.utcnow(),
    )
    db.add(session)

    # Create initial position estimate
    pos = PositionEstimate(
        session_id=session.id,
        x_m=body.start_x_m,
        y_m=body.start_y_m,
        heading_deg=0.0,
        drift_radius_m=0.0,
        map_matched=False,
        source="manual_set",
        estimated_at=datetime.utcnow(),
    )
    db.add(pos)

    await db.commit()
    await db.refresh(session)

    return SessionOut(
        id=str(session.id),
        user_id=str(session.user_id) if session.user_id else None,
        airport_id=str(session.airport_id),
        start_x_m=session.start_x_m,
        start_y_m=session.start_y_m,
        start_confirmed_by=session.start_confirmed_by,
        destination_poi_id=str(session.destination_poi_id) if session.destination_poi_id else None,
        route_mode=session.route_mode,
        nav_mode=session.nav_mode,
        ar_enabled=session.ar_enabled,
        status=session.status,
        started_at=session.started_at,
        ended_at=session.ended_at,
        replay_track_id=str(session.replay_track_id) if session.replay_track_id else None,
        total_distance_m=session.total_distance_m,
        total_steps=session.total_steps,
        max_drift_m=session.max_drift_m,
    )


@router.get("/sessions/{session_id}", response_model=SessionWithPositionOut)
async def get_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(DrSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get latest position
    pos_stmt = (
        select(PositionEstimate)
        .where(PositionEstimate.session_id == session_id)
        .order_by(PositionEstimate.estimated_at.desc())
        .limit(1)
    )
    pos_result = await db.execute(pos_stmt)
    latest_pos = pos_result.scalar_one_or_none()

    session_out = SessionOut(
        id=str(session.id),
        user_id=str(session.user_id) if session.user_id else None,
        airport_id=str(session.airport_id),
        start_x_m=session.start_x_m,
        start_y_m=session.start_y_m,
        start_confirmed_by=session.start_confirmed_by,
        destination_poi_id=str(session.destination_poi_id) if session.destination_poi_id else None,
        route_mode=session.route_mode,
        nav_mode=session.nav_mode,
        ar_enabled=session.ar_enabled,
        status=session.status,
        started_at=session.started_at,
        ended_at=session.ended_at,
        replay_track_id=str(session.replay_track_id) if session.replay_track_id else None,
        total_distance_m=session.total_distance_m,
        total_steps=session.total_steps,
        max_drift_m=session.max_drift_m,
    )

    pos_out = None
    if latest_pos:
        pos_out = PositionOut(
            x_m=latest_pos.x_m,
            y_m=latest_pos.y_m,
            heading_deg=latest_pos.heading_deg,
            drift_radius_m=latest_pos.drift_radius_m,
            map_matched=latest_pos.map_matched,
            snapped_node_id=str(latest_pos.snapped_node_id) if latest_pos.snapped_node_id else None,
            source=latest_pos.source,
        )

    return SessionWithPositionOut(session=session_out, latest_position=pos_out)


@router.patch("/sessions/{session_id}", response_model=SessionOut)
async def update_session(
    session_id: str,
    body: SessionUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(DrSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if body.status not in ("completed", "abandoned"):
        raise HTTPException(status_code=400, detail="Status must be 'completed' or 'abandoned'")

    session.status = body.status
    session.ended_at = datetime.utcnow()
    await db.commit()
    await db.refresh(session)

    return SessionOut(
        id=str(session.id),
        user_id=str(session.user_id) if session.user_id else None,
        airport_id=str(session.airport_id),
        start_x_m=session.start_x_m,
        start_y_m=session.start_y_m,
        start_confirmed_by=session.start_confirmed_by,
        destination_poi_id=str(session.destination_poi_id) if session.destination_poi_id else None,
        route_mode=session.route_mode,
        nav_mode=session.nav_mode,
        ar_enabled=session.ar_enabled,
        status=session.status,
        started_at=session.started_at,
        ended_at=session.ended_at,
        replay_track_id=str(session.replay_track_id) if session.replay_track_id else None,
        total_distance_m=session.total_distance_m,
        total_steps=session.total_steps,
        max_drift_m=session.max_drift_m,
    )
