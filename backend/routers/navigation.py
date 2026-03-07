from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models.identity import User
from models.navigation import NavEdge, NavNode
from schemas.navigation import RouteRequest, RouteResponse
from services.routing import astar, build_instructions

router = APIRouter()


@router.post("/route", response_model=RouteResponse)
async def compute_route(
    body: RouteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Load nodes
    node_stmt = select(NavNode).where(NavNode.airport_id == body.airport_id)
    node_result = await db.execute(node_stmt)
    nodes_orm = node_result.scalars().all()

    if not nodes_orm:
        raise HTTPException(status_code=404, detail="No navigation nodes found for airport")

    nodes = [
        {
            "id": str(n.id),
            "x_m": n.x_m,
            "y_m": n.y_m,
            "node_type": n.node_type,
            "poi_id": str(n.poi_id) if n.poi_id else None,
        }
        for n in nodes_orm
    ]
    nodes_by_id = {n["id"]: n for n in nodes}

    # Load edges
    node_ids = {n.id for n in nodes_orm}
    edge_stmt = select(NavEdge).where(
        NavEdge.from_node_id.in_(node_ids) | NavEdge.to_node_id.in_(node_ids)
    )
    edge_result = await db.execute(edge_stmt)
    edges_orm = edge_result.scalars().all()

    edges = [
        {
            "id": str(e.id),
            "from_node_id": str(e.from_node_id),
            "to_node_id": str(e.to_node_id),
            "distance_m": e.distance_m,
            "edge_type": e.edge_type,
            "is_accessible": e.is_accessible,
            "is_bidirectional": e.is_bidirectional,
            "crowding_factor": e.crowding_factor,
        }
        for e in edges_orm
    ]

    # Run A*
    route = astar(body.from_node_id, body.to_node_id, body.mode, nodes, edges)

    if not route["node_sequence"]:
        raise HTTPException(status_code=404, detail="No route found between the specified nodes")

    # Build instructions
    instructions = build_instructions(
        route["node_sequence"],
        route["edge_sequence"],
        nodes_by_id,
    )

    return RouteResponse(
        node_sequence=route["node_sequence"],
        total_distance_m=route["total_distance_m"],
        total_time_s=route["total_time_s"],
        instructions=instructions,
    )
