import asyncio

from fastapi import APIRouter, WebSocket

from .logic import (
    active_organizers,
    apply_draw_result,
    build_result,
    compute_auto_forced_players,
    organizer_set,
    reset_state,
    sanitize_names,
    select_players,
    state,
    validate_draw_mode,
)
from .models import (
    DrawRequest,
    ExcludedPlayersRequest,
    ForcedPlayersRequest,
    OrganizerConfigRequest,
    ParticipantsRequest,
    PresentationCompleteRequest,
)

router = APIRouter()


@router.get("/state")
def get_state():
    return state


@router.post("/participants")
def set_participants(req: ParticipantsRequest):
    state.participants = sanitize_names(req.participants, limit=1000)
    organizers = organizer_set()

    state.forced_players = [
        p for p in state.forced_players if p in state.participants and p not in organizers
    ][:2]
    state.excluded_players = [
        p for p in state.excluded_players if p in state.participants and p not in organizers
    ]
    state.last_players = [
        p for p in state.last_players if p in state.participants and p not in organizers
    ]
    state.prev_players = [
        p for p in state.prev_players if p in state.participants and p not in organizers
    ]
    state.spin_order = [
        p for p in state.spin_order if p in state.participants and p not in organizers
    ]
    state.miss_counts = {p: state.miss_counts.get(p, 0) for p in state.participants}
    state.participation_counts = {
        p: state.participation_counts.get(p, 0) for p in state.participants
    }
    state.auto_forced_players = compute_auto_forced_players(state.forced_players)

    return {"ok": True}


@router.post("/organizer_config")
def set_organizer_config(req: OrganizerConfigRequest):
    state.organizer_mode = req.organizer_mode
    state.organizers = sanitize_names(req.organizers, limit=2)
    state.selected_organizer_index = (
        1 if req.selected_organizer_index == 1 and len(state.organizers) > 1 else 0
    )

    organizers = organizer_set()
    state.forced_players = [p for p in state.forced_players if p not in organizers][:2]
    state.excluded_players = [p for p in state.excluded_players if p not in organizers]
    state.auto_forced_players = compute_auto_forced_players(state.forced_players)
    return {"ok": True}


@router.post("/forced_players")
def set_forced_players(req: ForcedPlayersRequest):
    unique = []
    organizers = organizer_set()
    for player in req.forced_players:
        if player in state.participants and player not in organizers and player not in unique:
            unique.append(player)

    state.forced_players = unique[:2]
    state.auto_forced_players = compute_auto_forced_players(state.forced_players)
    return {"ok": True}


@router.post("/excluded_players")
def set_excluded_players(req: ExcludedPlayersRequest):
    unique = []
    organizers = organizer_set()
    for player in req.excluded_players:
        if player in state.participants and player not in organizers and player not in unique:
            unique.append(player)

    state.excluded_players = unique
    state.auto_forced_players = compute_auto_forced_players(state.forced_players)
    return {"ok": True}


@router.post("/draw")
def draw(req: DrawRequest):
    validate_draw_mode(req.mode)

    required_count = (
        2 if req.mode in ("hosts_vs_duo", "hosts_split_pairs") else int(req.mode[-1])
    )
    selected, spin_order, selection_reasons = select_players(required_count)
    result = build_result(req.mode, spin_order)
    apply_draw_result(selected, spin_order, selection_reasons, result)

    return {"round_id": state.round_id, "result": result}


@router.post("/presentation_complete")
def presentation_complete(req: PresentationCompleteRequest):
    if req.round_id != state.round_id:
        return {"ok": False, "reason": "round_id_mismatch"}

    state.phase = "result"
    return {"ok": True}


@router.post("/reset")
def reset():
    reset_state()
    return {"ok": True}


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            payload = state.model_dump() if hasattr(state, "model_dump") else state.dict()
            await ws.send_json(payload)
            await asyncio.sleep(0.1)
    except Exception:
        pass
