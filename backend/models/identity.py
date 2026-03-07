import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, LargeBinary, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from models import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_auth_id = Column(Text, unique=True)
    auth_provider = Column(Text)
    username = Column(Text, unique=True)
    password_hash = Column(Text)
    email_hash = Column(LargeBinary, unique=True)
    phone_hash = Column(LargeBinary)
    display_name = Column(Text)
    preferred_language = Column(Text, nullable=False, default="en")
    nationality_code = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True)
    is_verified = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    last_seen_at = Column(DateTime(timezone=True))
    gdpr_consent_at = Column(DateTime(timezone=True))
    deletion_requested_at = Column(DateTime(timezone=True))


class BiometricProfile(Base):
    __tablename__ = "biometric_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    modality = Column(Text, nullable=False, default="face")
    face_descriptor = Column(JSONB)
    quality_score = Column(Float)
    liveness_score = Column(Float)
    enrolled_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    enrolled_device = Column(Text)
    is_primary = Column(Boolean, nullable=False, default=False)
    is_revoked = Column(Boolean, nullable=False, default=False)
    revoked_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))


class TravelDocument(Base):
    __tablename__ = "travel_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    document_type = Column(Text, nullable=False)
    document_number_enc = Column(Text, nullable=False)
    surname_enc = Column(Text, nullable=False)
    given_names_enc = Column(Text, nullable=False)
    dob_enc = Column(Text, nullable=False)
    nationality_code = Column(Text, nullable=False)
    issuing_country = Column(Text, nullable=False)
    expiry_date = Column(Date, nullable=False)
    verified_by = Column(Text)
    verified_at = Column(DateTime(timezone=True))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class VerificationToken(Base):
    __tablename__ = "verification_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    biometric_profile_id = Column(UUID(as_uuid=True), ForeignKey("biometric_profiles.id"))
    travel_document_id = Column(UUID(as_uuid=True), ForeignKey("travel_documents.id"))
    token_hash = Column(LargeBinary, nullable=False, unique=True)
    claims = Column(JSONB, nullable=False, default={})
    assurance_level = Column(Text, nullable=False, default="ial2")
    issued_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_revoked = Column(Boolean, nullable=False, default=False)
    revoked_at = Column(DateTime(timezone=True))
    revoked_reason = Column(Text)


class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    consent_type = Column(Text, nullable=False)
    given = Column(Boolean, nullable=False)
    given_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    withdrawn_at = Column(DateTime(timezone=True))
    ip_hash = Column(LargeBinary)
