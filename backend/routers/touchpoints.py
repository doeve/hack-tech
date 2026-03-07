import hashlib

from fastapi import APIRouter, Depends, HTTPException
from jose import JWTError, jwt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from config import settings
from database import get_db
from models.identity import User
from schemas.identity import TouchpointVerifyRequest, TouchpointVerifyResponse

router = APIRouter()


@router.post(
    "/touchpoints/{touchpoint_id}/verify", response_model=TouchpointVerifyResponse
)
async def verify_at_touchpoint(
    touchpoint_id: str,
    body: TouchpointVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Decode JWT to verify it's valid
    try:
        payload = jwt.decode(
            body.token_jwt, settings.secret_key, algorithms=["HS256"]
        )
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid verification token")

    # Compute token hash
    token_hash = hashlib.sha256(body.token_jwt.encode()).digest()

    # Call consume_token SQL function
    stmt = text(
        "SELECT consume_token(:token_hash, :touchpoint_id, :match_score, :device_id)"
    )
    result = await db.execute(
        stmt,
        {
            "token_hash": token_hash,
            "touchpoint_id": touchpoint_id,
            "match_score": body.match_score,
            "device_id": None,
        },
    )
    row = result.scalar_one()
    await db.commit()

    # row is a JSONB result from the function
    import json

    if isinstance(row, str):
        response_data = json.loads(row)
    else:
        response_data = row

    return TouchpointVerifyResponse(
        outcome=response_data.get("outcome", "fail"),
        claims=response_data.get("claims"),
    )
