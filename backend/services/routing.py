import heapq
import math


def _euclidean(n1: dict, n2: dict) -> float:
    return math.sqrt((n1["x_m"] - n2["x_m"]) ** 2 + (n1["y_m"] - n2["y_m"]) ** 2)


def _bearing(from_node: dict, to_node: dict) -> float:
    """Compute bearing in degrees (0=North, clockwise+)."""
    dx = to_node["x_m"] - from_node["x_m"]
    dy = to_node["y_m"] - from_node["y_m"]
    angle = math.degrees(math.atan2(dx, dy))
    return angle % 360


def astar(
    from_node_id: str,
    to_node_id: str,
    mode: str,
    nodes: list[dict],
    edges: list[dict],
) -> dict:
    """
    A* on the nav graph.
    Edge weight = distance_m * crowding_factor.
    Mode 'accessible': exclude edges where is_accessible=False or type='stairs'.
    Heuristic: euclidean distance to goal node.
    Returns: {node_sequence, edge_sequence, total_distance_m, total_time_s}
    """
    nodes_by_id = {str(n["id"]): n for n in nodes}

    # Build adjacency list
    adj: dict[str, list[tuple[str, str, float, dict]]] = {}
    for n in nodes:
        adj[str(n["id"])] = []

    for e in edges:
        fn = str(e["from_node_id"])
        tn = str(e["to_node_id"])

        # Filter for accessible mode
        if mode == "accessible":
            if not e.get("is_accessible", True) or e.get("edge_type") == "stairs":
                continue

        weight = e["distance_m"] * e.get("crowding_factor", 1.0)

        adj.setdefault(fn, []).append((tn, str(e["id"]), weight, e))
        if e.get("is_bidirectional", True):
            adj.setdefault(tn, []).append((fn, str(e["id"]), weight, e))

    if from_node_id not in nodes_by_id or to_node_id not in nodes_by_id:
        return {
            "node_sequence": [],
            "edge_sequence": [],
            "total_distance_m": 0,
            "total_time_s": 0,
        }

    goal = nodes_by_id[to_node_id]

    # Priority queue: (f_score, node_id)
    open_set = [(0.0, from_node_id)]
    g_score = {from_node_id: 0.0}
    came_from: dict[str, tuple[str, str]] = {}  # node_id -> (prev_node_id, edge_id)

    while open_set:
        _, current = heapq.heappop(open_set)

        if current == to_node_id:
            # Reconstruct path
            node_seq = [current]
            edge_seq = []
            while current in came_from:
                prev, eid = came_from[current]
                node_seq.append(prev)
                edge_seq.append(eid)
                current = prev
            node_seq.reverse()
            edge_seq.reverse()

            total_dist = g_score[to_node_id]
            # Estimate walking speed: ~1.4 m/s
            total_time = total_dist / 1.4

            return {
                "node_sequence": node_seq,
                "edge_sequence": edge_seq,
                "total_distance_m": round(total_dist, 1),
                "total_time_s": round(total_time, 1),
            }

        for neighbor, edge_id, weight, edge in adj.get(current, []):
            tentative_g = g_score[current] + weight
            if tentative_g < g_score.get(neighbor, float("inf")):
                g_score[neighbor] = tentative_g
                came_from[neighbor] = (current, edge_id)
                h = _euclidean(nodes_by_id[neighbor], goal)
                f = tentative_g + h
                heapq.heappush(open_set, (f, neighbor))

    # No path found
    return {
        "node_sequence": [],
        "edge_sequence": [],
        "total_distance_m": 0,
        "total_time_s": 0,
    }


def build_instructions(
    node_sequence: list[str],
    edge_sequence: list[str],
    nodes_by_id: dict[str, dict],
    edges_by_id: dict[str, dict] | None = None,
) -> list[dict]:
    """
    Compute bearing for each edge. Delta from previous bearing:
      < 20 deg  -> 'continue_straight'
      20-70 deg -> 'turn_slight_left' / 'turn_slight_right'
      > 70 deg  -> 'turn_left' / 'turn_right'
    Populate tts_text and haptic_cue for each instruction.
    """
    if len(node_sequence) < 2:
        return []

    instructions = []
    prev_bearing = None

    for i in range(len(node_sequence) - 1):
        from_n = nodes_by_id[node_sequence[i]]
        to_n = nodes_by_id[node_sequence[i + 1]]
        bearing = _bearing(from_n, to_n)
        dist = _euclidean(from_n, to_n)

        if prev_bearing is None:
            instruction_type = "continue_straight"
            haptic = "continue_straight"
            display = f"Head towards your destination for {dist:.0f}m"
            tts = f"Head straight for {dist:.0f} metres"
        else:
            delta = (bearing - prev_bearing + 360) % 360
            if delta > 180:
                delta = 360 - delta
                direction = "left"
            else:
                direction = "right"

            if delta < 20:
                instruction_type = "continue_straight"
                haptic = "continue_straight"
                display = f"Continue straight for {dist:.0f}m"
                tts = f"Continue straight for {dist:.0f} metres"
            elif delta < 70:
                instruction_type = f"turn_slight_{direction}"
                haptic = f"turn_{direction}"
                display = f"Slight {direction} for {dist:.0f}m"
                tts = f"In {dist:.0f} metres, turn slight {direction}"
            else:
                instruction_type = f"turn_{direction}"
                haptic = f"turn_{direction}"
                display = f"Turn {direction} for {dist:.0f}m"
                tts = f"Turn {direction} and continue for {dist:.0f} metres"

        instructions.append(
            {
                "step_index": i,
                "instruction_type": instruction_type,
                "distance_m": round(dist, 1),
                "bearing_deg": round(bearing, 1),
                "display_text": display,
                "tts_text": tts,
                "haptic_cue": haptic,
            }
        )

        prev_bearing = bearing

    return instructions
