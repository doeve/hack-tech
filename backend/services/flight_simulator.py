"""
Background flight-simulation worker.

Creates realistic flights in the DB and advances them through
Scheduled → Boarding → Gate Closed → Departed, with random delays,
gate changes, and cancellations.  Every significant event queues a
push notification so the frontend receives real-time alerts.
"""

import asyncio
import logging
import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select, update

from models.airport import Airport, Poi
from models.flights import Flight
from models.notifications import NotificationQueue
from models.push import PushSubscription

logger = logging.getLogger("flight_simulator")

# ── Configuration data ──────────────────────────────────────────────

AIRLINES = [
    ("UA", "United"), ("AA", "American"), ("DL", "Delta"),
    ("B6", "JetBlue"), ("SG", "SkyGuide"), ("EK", "Emirates"),
    ("BA", "British Airways"), ("LH", "Lufthansa"),
    ("AF", "Air France"), ("JL", "Japan Airlines"),
]

ROUTES = [
    ("SFO", "JFK"), ("LAX", "ORD"), ("SEA", "ATL"), ("BOS", "MCO"),
    ("LHR", "JFK"), ("CDG", "LAX"), ("NRT", "SFO"), ("DXB", "LHR"),
    ("FRA", "ORD"), ("SIN", "LAX"), ("ICN", "SEA"), ("MIA", "DFW"),
]

GATES = [
    "A01", "A03", "A05", "A07", "A09", "A11",
    "B02", "B07", "B12", "B15", "B18", "B24",
    "C01", "C04", "C06", "C08", "D02", "D04",
    "E01", "E02", "E04",
]

TERMINALS = ["1", "2", "3", "T5", "C"]

pick = lambda seq: random.choice(seq)
rint = lambda lo, hi: random.randint(lo, hi)

# ── Shared mutable state (controlled via admin endpoints) ───────────

_state = {
    "running": False,
    "speed": 1,          # 1x / 2x / 5x / 10x
    "elapsed": 0,        # simulated minutes since start
    "tick_s": 2.0,       # wall-seconds per simulated minute at 1x
}


def get_status():
    return dict(_state)

def start():
    _state["running"] = True

def stop():
    _state["running"] = False

def set_speed(speed: int):
    _state["speed"] = max(1, min(speed, 20))

def reset():
    _state["running"] = False
    _state["elapsed"] = 0
    _state["speed"] = 1


# ── Notification helper ─────────────────────────────────────────────

async def _notify(db, title: str, body: str, priority: str = "normal", payload: dict | None = None):
    """Queue a push notification to all subscribers."""
    result = await db.execute(select(PushSubscription))
    subs = result.scalars().all()
    for sub in subs:
        db.add(NotificationQueue(
            user_id=sub.user_id,
            device_key=sub.device_key,
            channel="push",
            title=title,
            body=body,
            priority=priority,
            payload=payload or {},
        ))


# ── Flight creation ─────────────────────────────────────────────────

async def _create_flight(db, airport_id, depart_offset_min: int | None = None):
    code, _ = pick(AIRLINES)
    origin, dest = pick(ROUTES)
    direction = pick(["departure", "arrival"])
    offset = depart_offset_min or rint(20, 150)

    now_utc = datetime.now(timezone.utc)
    scheduled = now_utc + timedelta(minutes=offset)

    flight = Flight(
        id=uuid.uuid4(),
        airport_id=airport_id,
        flight_number=f"{code} {rint(100, 9999)}",
        airline_iata=code,
        direction=direction,
        scheduled_at=scheduled,
        status="scheduled",
        raw_source={
            "gate": pick(GATES),
            "terminal": pick(TERMINALS),
            "origin": origin,
            "destination": dest,
        },
        synced_at=now_utc,
    )
    db.add(flight)
    return flight


# ── Main tick logic ─────────────────────────────────────────────────

async def _tick(db):
    _state["elapsed"] += 1
    now_utc = datetime.now(timezone.utc)

    # Get airport (first one)
    ap_result = await db.execute(select(Airport).limit(1))
    airport = ap_result.scalar_one_or_none()
    if not airport:
        return

    # Get active flights
    result = await db.execute(
        select(Flight)
        .where(Flight.airport_id == airport.id)
        .where(Flight.status.notin_(["departed", "cancelled", "landed"]))
    )
    flights = result.scalars().all()

    for f in flights:
        ttd = (f.scheduled_at - now_utc).total_seconds() / 60  # minutes to departure

        # ── Random delay (2 % per tick for scheduled flights with >25 min)
        if f.status == "scheduled" and ttd > 25 and random.random() < 0.02:
            delay = rint(10, 55)
            f.status = "delayed"
            f.estimated_at = f.scheduled_at + timedelta(minutes=delay)
            f.scheduled_at = f.estimated_at  # shift departure
            gate = (f.raw_source or {}).get("gate", "?")
            await _notify(db, "Flight Delayed",
                          f"{f.flight_number} delayed {delay}min — Gate {gate}",
                          "normal", {"type": "delay"})
            continue

        # ── Random gate change (1.5 %)
        if f.status in ("scheduled", "delayed") and ttd > 12 and random.random() < 0.015:
            src = f.raw_source or {}
            old_gate = src.get("gate", "?")
            new_gate = pick([g for g in GATES if g != old_gate])
            src["gate"] = new_gate
            f.raw_source = src
            await _notify(db, "Gate Change",
                          f"{f.flight_number} moved to Gate {new_gate} (was {old_gate})",
                          "normal", {"type": "gate_change"})

        # ── Boarding (28-8 min before departure)
        if f.status in ("scheduled", "delayed") and 8 < ttd <= 28:
            f.status = "boarding"
            gate = (f.raw_source or {}).get("gate", "?")
            await _notify(db, "Now Boarding",
                          f"Flight {f.flight_number} is boarding at Gate {gate}",
                          "normal", {"type": "boarding"})

        # ── Final call (≤ 8 min)
        if f.status == "boarding" and 0 < ttd <= 8:
            f.status = "gate_closed"
            gate = (f.raw_source or {}).get("gate", "?")
            await _notify(db, "Final Boarding Call",
                          f"Last call — {f.flight_number} at Gate {gate}!",
                          "high", {"type": "final_call"})

        # ── Departed (past scheduled time)
        if f.status in ("boarding", "gate_closed") and ttd <= 0:
            f.status = "departed"
            f.actual_at = now_utc
            gate = (f.raw_source or {}).get("gate", "?")
            await _notify(db, "Departed",
                          f"{f.flight_number} has departed from Gate {gate}",
                          "normal", {"type": "departed"})

        # ── Arrived (arrivals past scheduled)
        if f.direction == "arrival" and f.status == "scheduled" and ttd <= -5:
            f.status = "landed"
            f.actual_at = now_utc

    # ── Rare cancellation (0.4 %)
    scheduled = [f for f in flights if f.status == "scheduled"]
    if scheduled and random.random() < 0.004:
        f = pick(scheduled)
        f.status = "cancelled"
        await _notify(db, "Flight Cancelled",
                      f"{f.flight_number} has been cancelled",
                      "high", {"type": "cancelled"})

    # ── Create new flights periodically
    active_count = len([f for f in flights if f.status not in ("departed", "cancelled", "landed")])
    if _state["elapsed"] % 6 == 0 or active_count < 5:
        nf = await _create_flight(db, airport.id)
        gate = (nf.raw_source or {}).get("gate", "?")
        await _notify(db, "New Flight",
                      f"{nf.flight_number} added — Gate {gate}",
                      "normal", {"type": "new_flight"})

    # ── Purge very old departed/cancelled flights (> 30 min past)
    cutoff = now_utc - timedelta(minutes=30)
    await db.execute(
        delete(Flight)
        .where(Flight.airport_id == airport.id)
        .where(Flight.status.in_(["departed", "cancelled", "landed"]))
        .where(Flight.scheduled_at < cutoff)
    )

    await db.commit()


# ── Background loop ─────────────────────────────────────────────────

async def run_flight_simulator(db_factory):
    """Started as an asyncio task from main.py lifespan."""
    logger.info("Flight simulator worker ready (paused)")
    while True:
        try:
            if not _state["running"]:
                await asyncio.sleep(0.5)
                continue

            interval = _state["tick_s"] / _state["speed"]
            await asyncio.sleep(interval)

            async with db_factory() as db:
                await _tick(db)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Flight simulator tick error: {e}", exc_info=True)
            await asyncio.sleep(2)
