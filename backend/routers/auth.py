import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import create_access_token, hash_password, verify_password
from database import get_db
from models.identity import User
from schemas.auth import LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, UserInfo

router = APIRouter()


@router.post("/register", response_model=RegisterResponse)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check if username already exists
    stmt = select(User).where(User.username == body.username)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken",
        )

    user = User(
        id=uuid.uuid4(),
        username=body.username,
        password_hash=hash_password(body.password),
        auth_provider="local",
        display_name=body.display_name,
        nationality_code=body.nationality_code,
        is_active=True,
        is_verified=False,
        created_at=datetime.utcnow(),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id))
    return RegisterResponse(user_id=str(user.id), access_token=token)


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.username == body.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    # Update last_seen_at
    user.last_seen_at = datetime.utcnow()
    await db.commit()

    token = create_access_token(str(user.id))
    return LoginResponse(
        user_id=str(user.id),
        access_token=token,
        user=UserInfo(
            display_name=user.display_name,
            is_verified=user.is_verified,
        ),
    )
