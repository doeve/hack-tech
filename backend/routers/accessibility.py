import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models.accessibility import AccessibilityProfile, AudioCue, HapticPattern
from models.identity import User
from schemas.accessibility import (
    AccessibilityProfileOut,
    AccessibilityProfileUpdate,
    AudioCueOut,
    HapticPatternOut,
)

router = APIRouter()


@router.get("/accessibility", response_model=AccessibilityProfileOut)
async def get_or_create_accessibility_profile(
    device_key: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AccessibilityProfile).where(
        AccessibilityProfile.device_key == device_key
    )
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()

    if not profile:
        profile = AccessibilityProfile(
            id=uuid.uuid4(),
            device_key=device_key,
            user_id=current_user.id,
            updated_at=datetime.utcnow(),
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)

    return AccessibilityProfileOut(
        id=str(profile.id),
        device_key=profile.device_key,
        nav_mode=profile.nav_mode,
        haptics_enabled=profile.haptics_enabled,
        haptic_intensity=profile.haptic_intensity,
        tts_enabled=profile.tts_enabled,
        tts_speed=profile.tts_speed,
        tts_voice=profile.tts_voice,
        high_contrast=profile.high_contrast,
        font_scale=profile.font_scale,
        ar_enabled=profile.ar_enabled,
        avoid_stairs=profile.avoid_stairs,
        avoid_escalators=profile.avoid_escalators,
        extra_time_multiplier=profile.extra_time_multiplier,
        visual_impairment=profile.visual_impairment,
        hearing_impairment=profile.hearing_impairment,
        mobility_impairment=profile.mobility_impairment,
    )


@router.put("/accessibility", response_model=AccessibilityProfileOut)
async def update_accessibility_profile(
    body: AccessibilityProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Find the profile by user
    stmt = select(AccessibilityProfile).where(
        AccessibilityProfile.user_id == current_user.id
    )
    if body.device_key:
        stmt = select(AccessibilityProfile).where(
            AccessibilityProfile.device_key == body.device_key
        )

    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()

    if not profile:
        # Create one
        profile = AccessibilityProfile(
            id=uuid.uuid4(),
            device_key=body.device_key or "unknown",
            user_id=current_user.id,
            updated_at=datetime.utcnow(),
        )
        db.add(profile)

    # Update fields that are provided
    update_data = body.model_dump(exclude_unset=True, exclude_none=True)
    for key, value in update_data.items():
        if hasattr(profile, key):
            setattr(profile, key, value)
    profile.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(profile)

    return AccessibilityProfileOut(
        id=str(profile.id),
        device_key=profile.device_key,
        nav_mode=profile.nav_mode,
        haptics_enabled=profile.haptics_enabled,
        haptic_intensity=profile.haptic_intensity,
        tts_enabled=profile.tts_enabled,
        tts_speed=profile.tts_speed,
        tts_voice=profile.tts_voice,
        high_contrast=profile.high_contrast,
        font_scale=profile.font_scale,
        ar_enabled=profile.ar_enabled,
        avoid_stairs=profile.avoid_stairs,
        avoid_escalators=profile.avoid_escalators,
        extra_time_multiplier=profile.extra_time_multiplier,
        visual_impairment=profile.visual_impairment,
        hearing_impairment=profile.hearing_impairment,
        mobility_impairment=profile.mobility_impairment,
    )


@router.get("/haptic-patterns", response_model=list[HapticPatternOut])
async def list_haptic_patterns(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(HapticPattern)
    result = await db.execute(stmt)
    patterns = result.scalars().all()

    return [
        HapticPatternOut(
            id=str(p.id),
            name=p.name,
            description=p.description,
            category=p.category,
            duration_ms=p.duration_ms,
            vibration_pattern=list(p.vibration_pattern) if p.vibration_pattern else [],
            intensity=p.intensity,
        )
        for p in patterns
    ]


@router.get("/audio-cues", response_model=list[AudioCueOut])
async def list_audio_cues(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AudioCue)
    result = await db.execute(stmt)
    cues = result.scalars().all()

    return [
        AudioCueOut(
            id=str(c.id),
            name=c.name,
            description=c.description,
            category=c.category,
            tts_template=c.tts_template,
            language_code=c.language_code,
        )
        for c in cues
    ]
