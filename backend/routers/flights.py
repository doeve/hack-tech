import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models.flights import Flight, FlightSubscription
from models.identity import User
from schemas.flights import FlightOut, FlightSubscriptionOut

router = APIRouter()


@router.get("/flights", response_model=list[FlightOut])
async def list_flights(
    airport_id: str | None = Query(None),
    direction: str | None = Query(None),
    date_filter: str | None = Query(None, alias="date"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Flight)

    if airport_id:
        stmt = stmt.where(Flight.airport_id == airport_id)
    if direction:
        stmt = stmt.where(Flight.direction == direction)
    if date_filter:
        try:
            d = date.fromisoformat(date_filter)
            stmt = stmt.where(
                Flight.scheduled_at >= datetime(d.year, d.month, d.day),
                Flight.scheduled_at < datetime(d.year, d.month, d.day + 1)
                if d.day < 28
                else Flight.scheduled_at >= datetime(d.year, d.month, d.day),
            )
        except ValueError:
            pass

    stmt = stmt.order_by(Flight.scheduled_at.desc())
    result = await db.execute(stmt)
    flights = result.scalars().all()

    return [
        FlightOut(
            id=str(f.id),
            airport_id=str(f.airport_id),
            flight_number=f.flight_number,
            airline_iata=f.airline_iata.strip() if f.airline_iata else "",
            direction=f.direction,
            scheduled_at=f.scheduled_at,
            estimated_at=f.estimated_at,
            actual_at=f.actual_at,
            gate_poi_id=str(f.gate_poi_id) if f.gate_poi_id else None,
            status=f.status,
            baggage_belt=f.baggage_belt,
        )
        for f in flights
    ]


@router.post("/flights/{flight_id}/subscribe", response_model=FlightSubscriptionOut)
async def subscribe_to_flight(
    flight_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check if already subscribed
    stmt = select(FlightSubscription).where(
        FlightSubscription.user_id == current_user.id,
        FlightSubscription.flight_id == flight_id,
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        return FlightSubscriptionOut(subscription_id=str(existing.id))

    sub = FlightSubscription(
        id=uuid.uuid4(),
        user_id=current_user.id,
        flight_id=flight_id,
        subscribed_at=datetime.utcnow(),
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)

    return FlightSubscriptionOut(subscription_id=str(sub.id))


@router.get("/flights/subscribed", response_model=list[FlightOut])
async def get_subscribed_flights(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Flight)
        .join(FlightSubscription, FlightSubscription.flight_id == Flight.id)
        .where(FlightSubscription.user_id == current_user.id)
        .order_by(Flight.scheduled_at.desc())
    )
    result = await db.execute(stmt)
    flights = result.scalars().all()

    return [
        FlightOut(
            id=str(f.id),
            airport_id=str(f.airport_id),
            flight_number=f.flight_number,
            airline_iata=f.airline_iata.strip() if f.airline_iata else "",
            direction=f.direction,
            scheduled_at=f.scheduled_at,
            estimated_at=f.estimated_at,
            actual_at=f.actual_at,
            gate_poi_id=str(f.gate_poi_id) if f.gate_poi_id else None,
            status=f.status,
            baggage_belt=f.baggage_belt,
        )
        for f in flights
    ]
