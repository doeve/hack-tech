from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    jwt_expire_hours: int = 12
    encryption_key: str  # 32-byte hex for AES-256-GCM
    cors_origins: list[str] = ["https://localhost", "http://localhost:5173"]
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_contact_email: str = "demo@d3v.ninja"

    class Config:
        env_file = "../.env"


settings = Settings()
