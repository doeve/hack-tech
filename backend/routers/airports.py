from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models.airport import Airport, Poi, PoiCategory
from models.identity import User
from models.navigation import NavEdge, NavNode
from schemas.airport import AirportOut, NavEdgeOut, NavGraphOut, NavNodeOut, PoiOut

router = APIRouter()


@router.get("/airports", response_model=list[AirportOut])
async def list_airports(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Airport)
    result = await db.execute(stmt)
    airports = result.scalars().all()
    return [
        AirportOut(
            id=str(a.id),
            iata_code=a.iata_code.strip() if a.iata_code else "",
            name=a.name,
            floor_plan_url=a.floor_plan_url,
            px_per_metre=a.px_per_metre,
            width_m=a.width_m,
            height_m=a.height_m,
        )
        for a in airports
    ]


@router.get("/airports/{airport_id}/pois", response_model=list[PoiOut])
async def list_pois(
    airport_id: str,
    category: str | None = Query(None),
    q: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(
            Poi.id,
            Poi.name,
            PoiCategory.slug.label("category"),
            Poi.gate_number,
            Poi.x_m,
            Poi.y_m,
            Poi.is_accessible,
            Poi.tts_label,
        )
        .join(PoiCategory, Poi.category_id == PoiCategory.id)
        .where(Poi.airport_id == airport_id)
        .where(Poi.is_active.is_(True))
    )

    if category:
        stmt = stmt.where(PoiCategory.slug == category)
    if q:
        stmt = stmt.where(Poi.name.ilike(f"%{q}%"))

    result = await db.execute(stmt)
    rows = result.all()
    return [
        PoiOut(
            poi_id=str(r.id),
            name=r.name,
            category=r.category,
            gate_number=r.gate_number,
            x_m=r.x_m,
            y_m=r.y_m,
            is_accessible=r.is_accessible,
            tts_label=r.tts_label,
        )
        for r in rows
    ]


@router.get("/airports/{airport_id}/graph", response_model=NavGraphOut)
async def get_nav_graph(
    airport_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    node_stmt = select(NavNode).where(NavNode.airport_id == airport_id)
    node_result = await db.execute(node_stmt)
    nodes = node_result.scalars().all()

    node_ids = {n.id for n in nodes}

    edge_stmt = select(NavEdge).where(
        NavEdge.from_node_id.in_(node_ids) | NavEdge.to_node_id.in_(node_ids)
    )
    edge_result = await db.execute(edge_stmt)
    edges = edge_result.scalars().all()

    return NavGraphOut(
        nodes=[
            NavNodeOut(
                id=str(n.id),
                x_m=n.x_m,
                y_m=n.y_m,
                node_type=n.node_type,
                poi_id=str(n.poi_id) if n.poi_id else None,
            )
            for n in nodes
        ],
        edges=[
            NavEdgeOut(
                id=str(e.id),
                from_node_id=str(e.from_node_id),
                to_node_id=str(e.to_node_id),
                distance_m=e.distance_m,
                edge_type=e.edge_type,
                is_accessible=e.is_accessible,
            )
            for e in edges
        ],
    )
