import asyncio
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import SessionLocal, get_db
from models.dead_reckoning import DrSession, PositionEstimate
from models.identity import User
from models.replay import ReplayTrack
from schemas.replay import ReplayStartRequest, ReplayStopResponse, ReplayTrackOut

router = APIRouter()

# Track active replay tasks so we can cancel them
_replay_tasks: dict[str, asyncio.Task] = {}


@router.get("/replay/tracks", response_model=list[ReplayTrackOut])
async def list_replay_tracks(
    airport_id: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ReplayTrack)
    if airport_id:
        stmt = stmt.where(ReplayTrack.airport_id == airport_id)
    stmt = stmt.order_by(ReplayTrack.created_at.desc())

    result = await db.execute(stmt)
    tracks = result.scalars().all()

    return [
        ReplayTrackOut(
            id=str(t.id),
            airport_id=str(t.airport_id),
            name=t.name,
            description=t.description,
            total_steps=t.total_steps,
            duration_ms=t.duration_ms,
            created_at=t.created_at,
        )
        for t in tracks
    ]


async def _run_replay(session_id: str, track_id: str, speed_multiplier: float):
    """
    Background task: reads track_data, sleeps elapsed_ms/speed,
    inserts position_estimates with source='replay', pushes to WebSocket.
    """
    try:
        async with SessionLocal() as db:
            track = await db.get(ReplayTrack, track_id)
            if not track or not track.track_data:
                return

            points = track.track_data
            if not isinstance(points, list) or len(points) == 0:
                return

            prev_elapsed = 0

            for point in points:
                # Check if task was cancelled
                if session_id not in _replay_tasks:
                    break

                elapsed_ms = point.get("elapsed_ms", 0)
                wait_ms = (elapsed_ms - prev_elapsed) / speed_multiplier
                if wait_ms > 0:
                    await asyncio.sleep(wait_ms / 1000.0)
                prev_elapsed = elapsed_ms

                # Insert position estimate
                pos = PositionEstimate(
                    session_id=session_id,
                    x_m=point["x_m"],
                    y_m=point["y_m"],
                    heading_deg=point.get("heading_deg", 0),
                    drift_radius_m=point.get("drift_radius_m", 0),
                    map_matched=False,
                    source="replay",
                    estimated_at=datetime.utcnow(),
                )
                db.add(pos)
                await db.commit()

                # Broadcast to WebSocket
                from routers.positions import broadcast_position

                await broadcast_position(
                    session_id,
                    {
                        "x_m": pos.x_m,
                        "y_m": pos.y_m,
                        "heading_deg": pos.heading_deg,
                        "drift_radius_m": pos.drift_radius_m,
                        "source": "replay",
                        "estimated_at": pos.estimated_at.isoformat(),
                    },
                )

    except asyncio.CancelledError:
        pass
    finally:
        _replay_tasks.pop(session_id, None)


@router.post("/replay/start")
async def start_replay(
    body: ReplayStartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate session exists
    session = await db.get(DrSession, body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Validate track exists
    track = await db.get(ReplayTrack, body.track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Replay track not found")

    # Cancel existing replay if any
    if body.session_id in _replay_tasks:
        _replay_tasks[body.session_id].cancel()

    # Start background replay
    task = asyncio.create_task(
        _run_replay(body.session_id, body.track_id, body.speed_multiplier)
    )
    _replay_tasks[body.session_id] = task

    return {"status": "started"}


@router.post("/replay/stop/{session_id}", response_model=ReplayStopResponse)
async def stop_replay(
    session_id: str,
    current_user: User = Depends(get_current_user),
):
    task = _replay_tasks.pop(session_id, None)
    if task:
        task.cancel()

    return ReplayStopResponse(status="stopped")
