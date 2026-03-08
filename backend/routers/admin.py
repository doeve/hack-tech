import os
import shutil
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, Body, File, HTTPException, UploadFile
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models.airport import Airport, Poi
from models.flights import Flight
from models.notifications import NotificationQueue
from models.position_marker import PositionMarker
from services import flight_simulator as sim

router = APIRouter(prefix="/admin", tags=["admin"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


# ── Simulator controls ──────────────────────────────────────────────

@router.get("/sim/status")
async def sim_status(user=Depends(get_current_user)):
    return sim.get_status()


@router.post("/sim/start")
async def sim_start(user=Depends(get_current_user)):
    sim.start()
    return sim.get_status()


@router.post("/sim/stop")
async def sim_stop(user=Depends(get_current_user)):
    sim.stop()
    return sim.get_status()


@router.post("/sim/speed")
async def sim_speed(body: dict = Body(...), user=Depends(get_current_user)):
    sim.set_speed(int(body.get("speed", 1)))
    return sim.get_status()


@router.post("/sim/reset")
async def sim_reset(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    sim.reset()
    await db.execute(delete(Flight))
    await db.execute(delete(NotificationQueue))
    await db.commit()
    return {"ok": True, "message": "Simulation reset and DB cleared"}


# ── Map upload ──────────────────────────────────────────────────────

@router.post("/upload-map")
async def upload_map(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    ext = Path(file.filename or "map.png").suffix.lower()
    if ext not in (".png", ".jpg", ".jpeg", ".svg", ".webp"):
        raise HTTPException(400, "Unsupported image format")

    filename = f"floorplan_{uuid.uuid4().hex[:8]}{ext}"
    dest = UPLOAD_DIR / filename
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    url = f"/api/uploads/{filename}"

    # Update the first airport's floor_plan_url
    result = await db.execute(select(Airport).limit(1))
    airport = result.scalar_one_or_none()
    if airport:
        airport.floor_plan_url = url
        await db.commit()

    return {"url": url, "filename": filename}


@router.post("/upload-map/dimensions")
async def update_map_dimensions(
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(select(Airport).limit(1))
    airport = result.scalar_one_or_none()
    if not airport:
        raise HTTPException(404, "No airport found")
    if "width_m" in body:
        airport.width_m = float(body["width_m"])
    if "height_m" in body:
        airport.height_m = float(body["height_m"])
    await db.commit()
    return {"ok": True}


# ── POIs CRUD ───────────────────────────────────────────────────────

@router.post("/pois")
async def create_poi(body: dict = Body(...), db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    poi = Poi(
        airport_id=body.get("airport_id"),
        category_id=body.get("category_id", 1),
        name=body["name"],
        description=body.get("description"),
        x_m=body.get("x_m", 0),
        y_m=body.get("y_m", 0),
        gate_number=body.get("gate_number"),
        is_accessible=body.get("is_accessible", True),
        is_active=body.get("is_active", True),
        tts_label=body.get("tts_label"),
    )
    db.add(poi)
    await db.commit()
    await db.refresh(poi)
    return {"id": str(poi.id), "name": poi.name}


@router.put("/pois/{poi_id}")
async def update_poi(poi_id: str, body: dict = Body(...), db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    result = await db.execute(select(Poi).where(Poi.id == poi_id))
    poi = result.scalar_one_or_none()
    if not poi:
        raise HTTPException(404, "POI not found")
    for key in ("name", "description", "x_m", "y_m", "gate_number", "category_id",
                "is_accessible", "is_active", "tts_label"):
        if key in body:
            setattr(poi, key, body[key])
    await db.commit()
    return {"ok": True}


@router.delete("/pois/{poi_id}")
async def delete_poi(poi_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    # Nullify FK references before deleting
    from models.flights import Flight
    from models.navigation import NavNode
    from models.dead_reckoning import DrSession
    from models.touchpoints import Touchpoint
    await db.execute(update(Flight).where(Flight.gate_poi_id == poi_id).values(gate_poi_id=None))
    await db.execute(update(NavNode).where(NavNode.poi_id == poi_id).values(poi_id=None))
    await db.execute(update(DrSession).where(DrSession.destination_poi_id == poi_id).values(destination_poi_id=None))
    await db.execute(update(Touchpoint).where(Touchpoint.poi_id == poi_id).values(poi_id=None))
    await db.execute(delete(Poi).where(Poi.id == poi_id))
    await db.commit()
    return {"ok": True}


# ── Position Markers ───────────────────────────────────────────────

@router.get("/position-markers")
async def list_position_markers(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    result = await db.execute(select(PositionMarker))
    markers = result.scalars().all()
    return [
        {"id": str(m.id), "airport_id": str(m.airport_id), "name": m.name, "x_m": m.x_m, "y_m": m.y_m}
        for m in markers
    ]


@router.post("/position-markers")
async def create_position_marker(body: dict = Body(...), db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    marker = PositionMarker(
        airport_id=body["airport_id"],
        name=body["name"],
        x_m=body["x_m"],
        y_m=body["y_m"],
    )
    db.add(marker)
    await db.commit()
    await db.refresh(marker)
    return {"id": str(marker.id), "airport_id": str(marker.airport_id), "name": marker.name, "x_m": marker.x_m, "y_m": marker.y_m}


@router.delete("/position-markers/{marker_id}")
async def delete_position_marker(marker_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await db.execute(delete(PositionMarker).where(PositionMarker.id == marker_id))
    await db.commit()
    return {"ok": True}


# ── Notifications ───────────────────────────────────────────────────

@router.post("/notify")
async def send_notification(body: dict = Body(...), db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    from models.push import PushSubscription

    title = body.get("title", "SkyGuide Alert")
    msg_body = body.get("body", "")
    priority = body.get("priority", "normal")
    target_user = body.get("user_id")

    query = select(PushSubscription)
    if target_user:
        query = query.where(PushSubscription.user_id == target_user)
    result = await db.execute(query)
    subs = result.scalars().all()

    count = 0
    for sub in subs:
        db.add(NotificationQueue(
            user_id=sub.user_id,
            device_key=sub.device_key,
            channel="push",
            title=title,
            body=msg_body,
            priority=priority,
            payload=body.get("payload", {}),
        ))
        count += 1

    await db.commit()
    return {"queued": count}


@router.post("/announce")
async def pa_announcement(body: dict = Body(...), db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    message = body.get("message", "")
    from models.push import PushSubscription

    result = await db.execute(select(PushSubscription))
    subs = result.scalars().all()

    count = 0
    for sub in subs:
        db.add(NotificationQueue(
            user_id=sub.user_id,
            device_key=sub.device_key,
            channel="push",
            title="PA Announcement",
            body=message,
            priority="high",
            payload={"type": "announcement", "message": message},
        ))
        count += 1

    await db.commit()
    return {"queued": count, "message": message}
