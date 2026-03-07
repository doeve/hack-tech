from pydantic import BaseModel


class VapidPublicKeyOut(BaseModel):
    public_key: str


class PushSubscribeRequest(BaseModel):
    endpoint: str
    keys: dict  # {p256dh, auth}
    device_key: str


class PushSubscribeResponse(BaseModel):
    subscription_id: str


class PushUnsubscribeRequest(BaseModel):
    endpoint: str


class PushTestRequest(BaseModel):
    title: str | None = "Test Notification"
    body: str | None = "This is a test push notification from Airport Companion."


class StatusResponse(BaseModel):
    status: str
