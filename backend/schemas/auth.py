from pydantic import BaseModel


class RegisterRequest(BaseModel):
    username: str
    password: str
    display_name: str | None = None
    nationality_code: str | None = None


class RegisterResponse(BaseModel):
    user_id: str
    access_token: str


class LoginRequest(BaseModel):
    username: str
    password: str


class UserInfo(BaseModel):
    display_name: str | None = None
    is_verified: bool


class LoginResponse(BaseModel):
    user_id: str
    access_token: str
    user: UserInfo
