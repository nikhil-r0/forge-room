from .contracts import BlameEdge, BlameNode


def build_blame_graph(decisions: list[dict], new_ids: set[str] | None = None) -> tuple[list[BlameNode], list[BlameEdge]]:
    fresh = new_ids or set()
    nodes: list[BlameNode] = []
    edges: list[BlameEdge] = []

    for decision in decisions:
        nodes.append(
            BlameNode(
                id=decision["id"],
                label=(decision["description"][:60] + "...") if len(decision["description"]) > 60 else decision["description"],
                category=decision["category"],
                risk_score=float(decision.get("risk_score", 0.0)),
                is_new=decision["id"] in fresh,
            )
        )
        for dep_id in decision.get("depends_on", []):
            edges.append(
                BlameEdge(
                    id=f"dep-{decision['id']}-{dep_id}",
                    source=dep_id,
                    target=decision["id"],
                    type="depends_on",
                )
            )
        for contra_id in decision.get("contradicts", []):
            edges.append(
                BlameEdge(
                    id=f"contra-{decision['id']}-{contra_id}",
                    source=decision["id"],
                    target=contra_id,
                    type="contradicts",
                )
            )

    return nodes, edges
