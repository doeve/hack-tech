from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models so Base.metadata picks them up
from models.airport import Airport, Zone, PoiCategory, Poi  # noqa: E402, F401
from models.navigation import NavNode, NavEdge  # noqa: E402, F401
from models.dead_reckoning import (  # noqa: E402, F401
    DrSession,
    ImuReading,
    StepEvent,
    PositionEstimate,
)
from models.replay import ReplayTrack  # noqa: E402, F401
from models.identity import (  # noqa: E402, F401
    User,
    BiometricProfile,
    TravelDocument,
    VerificationToken,
    ConsentRecord,
)
from models.touchpoints import Touchpoint, VerificationEvent  # noqa: E402, F401
from models.accessibility import (  # noqa: E402, F401
    AccessibilityProfile,
    HapticPattern,
    AudioCue,
)
from models.flights import Flight, FlightSubscription  # noqa: E402, F401
from models.notifications import NotificationQueue  # noqa: E402, F401
from models.push import PushSubscription  # noqa: E402, F401
