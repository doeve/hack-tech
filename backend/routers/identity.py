import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from config import settings
from database import get_db
from models.flights import Flight
from models.identity import (
    BiometricProfile,
    TravelDocument,
    User,
    VerificationToken,
)
from schemas.identity import (
    DocumentRequest,
    DocumentResponse,
    FaceDescriptorOut,
    FaceEnrollRequest,
    FaceEnrollResponse,
    IdentityStatusOut,
    IssueTokenRequest,
    IssueTokenResponse,
)
from services.identity import build_claims, encrypt_field, issue_verification_token

router = APIRouter()


@router.post("/identity/enroll-face", response_model=FaceEnrollResponse)
async def enroll_face(
    body: FaceEnrollRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if len(body.face_descriptor) != 128:
        raise HTTPException(
            status_code=400, detail="Face descriptor must be a 128-element float array"
        )

    # Revoke existing primary biometric
    stmt = select(BiometricProfile).where(
        BiometricProfile.user_id == current_user.id,
        BiometricProfile.is_primary.is_(True),
        BiometricProfile.is_revoked.is_(False),
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        existing.is_revoked = True
        existing.revoked_at = datetime.utcnow()

    profile = BiometricProfile(
        id=uuid.uuid4(),
        user_id=current_user.id,
        modality="face",
        face_descriptor=body.face_descriptor,
        quality_score=body.quality_score,
        liveness_score=body.liveness_score,
        enrolled_at=datetime.utcnow(),
        is_primary=True,
        is_revoked=False,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)

    return FaceEnrollResponse(
        biometric_id=str(profile.id),
        enrolled_at=profile.enrolled_at,
    )


@router.get("/identity/face-descriptor/{user_id}", response_model=FaceDescriptorOut)
async def get_face_descriptor(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only the authenticated user can access their own descriptor
    if str(current_user.id) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot access another user's biometric data",
        )

    stmt = select(BiometricProfile).where(
        BiometricProfile.user_id == user_id,
        BiometricProfile.is_primary.is_(True),
        BiometricProfile.is_revoked.is_(False),
    )
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()

    if not profile or not profile.face_descriptor:
        raise HTTPException(status_code=404, detail="No face descriptor found")

    return FaceDescriptorOut(face_descriptor=profile.face_descriptor)


@router.post("/identity/document", response_model=DocumentResponse)
async def submit_document(
    body: DocumentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # AES-256-GCM encrypt sensitive fields before INSERT
    doc = TravelDocument(
        id=uuid.uuid4(),
        user_id=current_user.id,
        document_type=body.document_type,
        document_number_enc=encrypt_field(body.document_number),
        surname_enc=encrypt_field(body.surname),
        given_names_enc=encrypt_field(body.given_names),
        dob_enc=encrypt_field(body.dob),
        nationality_code=body.nationality_code,
        issuing_country=body.issuing_country,
        expiry_date=body.expiry_date,
        verified_by="manual",
        verified_at=datetime.utcnow(),
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return DocumentResponse(document_id=str(doc.id), verified_by="manual")


@router.post("/identity/issue-token", response_model=IssueTokenResponse)
async def issue_token(
    body: IssueTokenRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate: active biometric profile
    bio_stmt = select(BiometricProfile).where(
        BiometricProfile.user_id == current_user.id,
        BiometricProfile.is_primary.is_(True),
        BiometricProfile.is_revoked.is_(False),
    )
    bio_result = await db.execute(bio_stmt)
    bio = bio_result.scalar_one_or_none()
    if not bio:
        raise HTTPException(status_code=400, detail="No active biometric profile found")

    # Validate: active non-expired document
    doc_stmt = select(TravelDocument).where(
        TravelDocument.user_id == current_user.id,
        TravelDocument.is_active.is_(True),
    )
    doc_result = await db.execute(doc_stmt)
    doc = doc_result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=400, detail="No active travel document found")

    # Look up flight
    flight_stmt = select(Flight).where(
        Flight.flight_number == body.flight_number,
    )
    flight_result = await db.execute(flight_stmt)
    flight = flight_result.scalar_one_or_none()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")

    # Eagerly load gate POI if needed
    if flight.gate_poi_id:
        from models.airport import Poi

        gate_poi = await db.get(Poi, flight.gate_poi_id)
        # Attach for build_claims
        flight.gate_poi = gate_poi
    else:
        flight.gate_poi = None

    # Build claims
    claims = build_claims(current_user, bio, doc, flight)

    # Issue token
    token_str, expires_at, token_hash = issue_verification_token(
        str(current_user.id), claims, settings.secret_key, settings.jwt_expire_hours
    )

    # Store token hash in DB
    vt = VerificationToken(
        id=uuid.uuid4(),
        user_id=current_user.id,
        biometric_profile_id=bio.id,
        travel_document_id=doc.id,
        token_hash=token_hash,
        claims=claims,
        assurance_level="ial2",
        issued_at=datetime.utcnow(),
        expires_at=expires_at,
    )
    db.add(vt)
    await db.commit()

    return IssueTokenResponse(token=token_str, claims=claims, expires_at=expires_at)


@router.get("/identity/status", response_model=IdentityStatusOut)
async def get_identity_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Query the v_user_identity_status view
    stmt = text(
        "SELECT * FROM v_user_identity_status WHERE id = :user_id"
    )
    result = await db.execute(stmt, {"user_id": str(current_user.id)})
    row = result.mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Identity status not found")

    return IdentityStatusOut(
        id=str(row["id"]),
        username=row["username"],
        display_name=row["display_name"],
        is_verified=row["is_verified"],
        biometric_id=str(row["biometric_id"]) if row["biometric_id"] else None,
        modality=row["modality"],
        quality_score=row["quality_score"],
        has_face_descriptor=row["has_face_descriptor"],
        document_type=row["document_type"],
        nationality_code=row["nationality_code"],
        expiry_date=row["expiry_date"],
        verified_by=row["verified_by"],
        active_token_id=str(row["active_token_id"]) if row["active_token_id"] else None,
        claims=row["claims"],
        assurance_level=row["assurance_level"],
        token_expires_at=row["token_expires_at"],
        token_revoked=row["token_revoked"],
    )
