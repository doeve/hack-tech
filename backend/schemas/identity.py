from datetime import date, datetime

from pydantic import BaseModel


class FaceEnrollRequest(BaseModel):
    face_descriptor: list[float]
    quality_score: float | None = None
    liveness_score: float | None = None


class FaceEnrollResponse(BaseModel):
    biometric_id: str
    enrolled_at: datetime


class FaceDescriptorOut(BaseModel):
    face_descriptor: list[float]


class DocumentRequest(BaseModel):
    document_type: str
    document_number: str
    surname: str
    given_names: str
    dob: str  # YYYYMMDD or YYYY-MM-DD
    nationality_code: str
    issuing_country: str
    expiry_date: date


class DocumentResponse(BaseModel):
    document_id: str
    verified_by: str


class IssueTokenRequest(BaseModel):
    flight_number: str


class IssueTokenResponse(BaseModel):
    token: str
    claims: dict
    expires_at: datetime


class IdentityStatusOut(BaseModel):
    id: str
    username: str | None = None
    display_name: str | None = None
    is_verified: bool
    biometric_id: str | None = None
    modality: str | None = None
    quality_score: float | None = None
    has_face_descriptor: bool | None = None
    document_type: str | None = None
    nationality_code: str | None = None
    expiry_date: date | None = None
    verified_by: str | None = None
    active_token_id: str | None = None
    claims: dict | None = None
    assurance_level: str | None = None
    token_expires_at: datetime | None = None
    token_revoked: bool | None = None

    model_config = {"from_attributes": True}


class TouchpointVerifyRequest(BaseModel):
    token_jwt: str
    match_score: float


class TouchpointVerifyResponse(BaseModel):
    outcome: str
    claims: dict | None = None
