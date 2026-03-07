import uuid

from sqlalchemy import Boolean, Column, Float, ForeignKey, SmallInteger, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from models import Base


class NavNode(Base):
    __tablename__ = "nav_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    airport_id = Column(
        UUID(as_uuid=True), ForeignKey("airports.id", ondelete="CASCADE"), nullable=False
    )
    poi_id = Column(UUID(as_uuid=True), ForeignKey("pois.id"))
    x_m = Column(Float, nullable=False)
    y_m = Column(Float, nullable=False)
    node_type = Column(Text, nullable=False, default="waypoint")
    is_accessible = Column(Boolean, nullable=False, default=True)

    poi = relationship("Poi")


class NavEdge(Base):
    __tablename__ = "nav_edges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    from_node_id = Column(
        UUID(as_uuid=True), ForeignKey("nav_nodes.id", ondelete="CASCADE"), nullable=False
    )
    to_node_id = Column(
        UUID(as_uuid=True), ForeignKey("nav_nodes.id", ondelete="CASCADE"), nullable=False
    )
    distance_m = Column(Float, nullable=False)
    travel_time_s = Column(SmallInteger)
    edge_type = Column(Text, nullable=False, default="walkway")
    is_accessible = Column(Boolean, nullable=False, default=True)
    is_bidirectional = Column(Boolean, nullable=False, default=True)
    crowding_factor = Column(Float, nullable=False, default=1.0)
    crowding_updated_at = Column(Text)

    from_node = relationship("NavNode", foreign_keys=[from_node_id])
    to_node = relationship("NavNode", foreign_keys=[to_node_id])
