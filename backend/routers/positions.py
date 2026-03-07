import json
from datetime import datetime

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import SessionLocal, get_db
from models.dead_reckoning import DrSession, PositionEstimate
from models.identity import User

router = APIRouter()

# Active WebSocket connections per session
_ws_connections: dict[str, list[WebSocket]] = {}


async def broadcast_position(session_id: str, position: dict):
    """Broadcast a position update to all WebSocket clients for a session."""
    connections = _ws_connections.get(session_id, [])
    dead = []
    for ws in connections:
        try:
            await ws.send_json(position)
        except Exception:
            dead.append(ws)
    for ws in dead:
        connections.remove(ws)


@router.websocket("/ws/positions/{session_id}")
async def websocket_positions(websocket: WebSocket, session_id: str):
    # Verify JWT on upgrade
    token = None
    auth_header = websocket.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    else:
        # Try query parameter as fallback
        token = websocket.query_params.get("token")

    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()

    # Register connection
    if session_id not in _ws_connections:
        _ws_connections[session_id] = []
    _ws_connections[session_id].append(websocket)

    try:
        # Send current position on connect
        async with SessionLocal() as db:
            pos_stmt = (
                select(PositionEstimate)
                .where(PositionEstimate.session_id == session_id)
                .order_by(PositionEstimate.estimated_at.desc())
                .limit(1)
            )
            pos_result = await db.execute(pos_stmt)
            latest = pos_result.scalar_one_or_none()

            if latest:
                await websocket.send_json(
                    {
                        "x_m": latest.x_m,
                        "y_m": latest.y_m,
                        "heading_deg": latest.heading_deg,
                        "drift_radius_m": latest.drift_radius_m,
                        "source": latest.source,
                        "estimated_at": latest.estimated_at.isoformat()
                        if latest.estimated_at
                        else None,
                    }
                )

        # Listen for client messages
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg.get("type") == "confirm_position":
                # User confirms their position, reset drift
                async with SessionLocal() as db:
                    pos = PositionEstimate(
                        session_id=session_id,
                        x_m=msg["x_m"],
                        y_m=msg["y_m"],
                        heading_deg=msg.get("heading_deg", 0),
                        drift_radius_m=0.0,
                        map_matched=False,
                        source="manual_set",
                        estimated_at=datetime.utcnow(),
                    )
                    db.add(pos)
                    await db.commit()

                    position = {
                        "x_m": pos.x_m,
                        "y_m": pos.y_m,
                        "heading_deg": pos.heading_deg,
                        "drift_radius_m": pos.drift_radius_m,
                        "source": pos.source,
                        "estimated_at": pos.estimated_at.isoformat(),
                    }
                    await broadcast_position(session_id, position)

            elif msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
    finally:
        if session_id in _ws_connections:
            if websocket in _ws_connections[session_id]:
                _ws_connections[session_id].remove(websocket)
            if not _ws_connections[session_id]:
                del _ws_connections[session_id]
