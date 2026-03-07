import base64
import hashlib
import os
from datetime import date, datetime, timedelta

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from jose import jwt

from config import settings

ENCRYPTION_KEY = bytes.fromhex(settings.encryption_key)


def encrypt_field(plaintext: str) -> str:
    """AES-256-GCM. Returns base64(nonce[12] + ciphertext + tag)."""
    aesgcm = AESGCM(ENCRYPTION_KEY)
    nonce = os.urandom(12)
    ct = aesgcm.encrypt(nonce, plaintext.encode(), None)
    return base64.b64encode(nonce + ct).decode()


def decrypt_field(encrypted: str) -> str:
    """Decrypt AES-256-GCM field."""
    data = base64.b64decode(encrypted)
    aesgcm = AESGCM(ENCRYPTION_KEY)
    return aesgcm.decrypt(data[:12], data[12:], None).decode()


def build_claims(user, biometric_profile, travel_doc, flight) -> dict:
    """
    Returns:
    {
        age_verified: bool,           # computed from decrypted dob vs today
        nationality_verified: bool,   # travel_doc.nationality_code present
        ticket_valid: bool,           # flight.status not in ('cancelled','departed')
        flight_number: str,
        gate: str,                    # from gate POI
        boarding_group: str | None,
        assurance_level: "ial2"
    }
    """
    # Compute age_verified from dob
    age_verified = False
    try:
        dob_str = decrypt_field(travel_doc.dob_enc)
        # Handle both YYYYMMDD and YYYY-MM-DD formats
        if "-" in dob_str:
            dob = datetime.strptime(dob_str, "%Y-%m-%d").date()
        else:
            dob = datetime.strptime(dob_str, "%Y%m%d").date()
        today = date.today()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        age_verified = age >= 18
    except Exception:
        age_verified = False

    nationality_verified = bool(travel_doc.nationality_code)

    ticket_valid = flight.status not in ("cancelled", "departed")

    # Get gate from flight's gate POI
    gate = None
    if flight.gate_poi is not None:
        gate = flight.gate_poi.gate_number or flight.gate_poi.name
    elif flight.gate_poi_id is not None:
        gate = "assigned"

    return {
        "age_verified": age_verified,
        "nationality_verified": nationality_verified,
        "ticket_valid": ticket_valid,
        "flight_number": flight.flight_number,
        "gate": gate,
        "boarding_group": None,
        "assurance_level": "ial2",
    }


def issue_verification_token(
    user_id: str, claims: dict, secret_key: str, expire_hours: int = 12
) -> tuple[str, datetime, bytes]:
    """
    Sign JWT HS256. Returns (token_str, expires_at, token_hash_bytes).
    Caller stores digest(token, sha256) in DB.
    """
    expires_at = datetime.utcnow() + timedelta(hours=expire_hours)
    payload = {
        "sub": user_id,
        "claims": claims,
        "exp": expires_at,
        "iat": datetime.utcnow(),
        "type": "verification",
    }
    token_str = jwt.encode(payload, secret_key, algorithm="HS256")
    token_hash = hashlib.sha256(token_str.encode()).digest()
    return token_str, expires_at, token_hash
