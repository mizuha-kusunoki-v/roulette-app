from typing import Dict, List, Literal
import asyncio
import random
import statistics
import uuid

from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from draw_config import (
    AUTO_FORCE_MAX_PER_DRAW,
    AUTO_FORCE_MEDIAN_GAP,
    ENABLE_AUTO_FORCE_BY_MEDIAN_GAP,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


OrganizerMode = Literal["single", "double"]
DrawMode = Literal["standard_3", "standard_4", "hosts_vs_duo", "hosts_split_pairs"]


class ResultTeam(BaseModel):
    label: str
    players: List[str]


class RouletteResult(BaseModel):
    kind: DrawMode
    teams: List[ResultTeam]


class RouletteState(BaseModel):
    participants: List[str] = []
    organizer_mode: OrganizerMode = "single"
    organizers: List[str] = []
    forced_players: List[str] = []
    auto_forced_players: List[str] = []
    excluded_players: List[str] = []
    participation_counts: Dict[str, int] = {}
    prev_players: List[str] = []
    last_players: List[str] = []
    spin_order: List[str] = []
    miss_counts: Dict[str, int] = {}
    last_selection_reasons: Dict[str, str] = {}
    result: RouletteResult | None = None
    round_id: str | None = None
    phase: Literal["idle", "spinning", "result"] = "idle"


state = RouletteState()


class ParticipantsRequest(BaseModel):
    participants: List[str]


class OrganizerConfigRequest(BaseModel):
    organizer_mode: OrganizerMode
    organizers: List[str]


class ForcedPlayersRequest(BaseModel):
    forced_players: List[str]


class ExcludedPlayersRequest(BaseModel):
    excluded_players: List[str]


class DrawRequest(BaseModel):
    mode: DrawMode


class PresentationCompleteRequest(BaseModel):
    round_id: str


def reset_state():
    global state
    state = RouletteState()


def sanitize_names(names: List[str], limit: int) -> List[str]:
    unique: List[str] = []
    for name in names:
        trimmed = name.strip()
        if trimmed and trimmed not in unique:
            unique.append(trimmed)
        if len(unique) >= limit:
            break
    return unique


def organizer_set() -> set[str]:
    return set(state.organizers)


def compute_auto_forced_players(
    manual_forced: List[str],
    excluded_players: List[str] | None = None,
) -> List[str]:
    if not ENABLE_AUTO_FORCE_BY_MEDIAN_GAP or not state.participants:
        return []

    excluded_set = set(excluded_players or [])
    organizers = organizer_set()
    participant_counts = [state.participation_counts.get(p, 0) for p in state.participants if p not in organizers]
    if not participant_counts:
        return []

    median_count = statistics.median(participant_counts)
    threshold = median_count - AUTO_FORCE_MEDIAN_GAP

    auto_forced = [
        p
        for p in state.participants
        if p not in organizers
        and p not in manual_forced
        and p not in state.last_players
        and p not in excluded_set
        and state.miss_counts.get(p, 0) < 3
        and state.participation_counts.get(p, 0) <= threshold
    ]
    auto_forced.sort(key=lambda p: (state.participation_counts.get(p, 0), p))
    if AUTO_FORCE_MAX_PER_DRAW > 0:
        auto_forced = auto_forced[:AUTO_FORCE_MAX_PER_DRAW]
    return auto_forced


def validate_draw_mode(mode: DrawMode):
    if state.organizer_mode == "single" and mode not in ("standard_3", "standard_4"):
        raise HTTPException(status_code=400, detail="single organizer mode supports only standard draws")

    if state.organizer_mode == "double" and mode not in ("hosts_vs_duo", "hosts_split_pairs"):
        raise HTTPException(status_code=400, detail="double organizer mode supports only 2-player draws")

    if state.organizer_mode == "double" and len(state.organizers) < 2:
        raise HTTPException(status_code=400, detail="two organizers are required")


def select_players(count: int):
    selection_reasons: Dict[str, str] = {}

    def append_with_reason(candidates: List[str], reason: str, need: int):
        if need <= 0:
            return []
        picked = candidates[:need]
        for player in picked:
            if player not in selection_reasons:
                selection_reasons[player] = reason
        return picked

    organizers = organizer_set()

    manual_forced = [
        p for p in state.forced_players if p in state.participants and p not in organizers
    ][:2]
    selected = append_with_reason(manual_forced, "manual_check", count)

    available = [
        p
        for p in state.participants
        if p not in organizers
        and p not in state.last_players
        and p not in selected
        and p not in state.excluded_players
    ]

    guaranteed = [p for p in available if state.miss_counts.get(p, 0) >= 3]
    selected += append_with_reason(guaranteed, "miss_3", count - len(selected))

    auto_forced = compute_auto_forced_players(manual_forced, selected)
    selected += append_with_reason(auto_forced, "median_gap", count - len(selected))

    if len(selected) < count:
        pool = [p for p in available if p not in selected]
        random.shuffle(pool)
        selected += append_with_reason(pool, "random", count - len(selected))

    if len(selected) < count and state.last_players:
        prev_pool = [
            p
            for p in state.last_players
            if p not in organizers and p not in selected and p not in state.excluded_players
        ]
        random.shuffle(prev_pool)
        selected += append_with_reason(prev_pool, "exception_prev_round", count - len(selected))

    if len(selected) < count:
        raise HTTPException(status_code=400, detail="not enough eligible participants")

    spin_order = selected.copy()
    random.shuffle(spin_order)
    return selected, spin_order, selection_reasons


def build_result(mode: DrawMode, spin_order: List[str]) -> RouletteResult:
    if mode == "standard_3":
        team_a_players = [spin_order[0]]
        if state.organizer_mode == "single" and state.organizers:
            team_a_players = [state.organizers[0], spin_order[0]]

        return RouletteResult(
            kind=mode,
            teams=[
                ResultTeam(label="チーム A", players=team_a_players),
                ResultTeam(label="チーム B", players=[spin_order[1], spin_order[2]]),
            ],
        )

    if mode == "standard_4":
        return RouletteResult(
            kind=mode,
            teams=[
                ResultTeam(label="チーム A", players=[spin_order[0], spin_order[1]]),
                ResultTeam(label="チーム B", players=[spin_order[2], spin_order[3]]),
            ],
        )

    if mode == "hosts_vs_duo":
        return RouletteResult(
            kind=mode,
            teams=[
                ResultTeam(label="主催チーム", players=state.organizers[:2]),
                ResultTeam(label="挑戦者チーム", players=spin_order[:2]),
            ],
        )

    return RouletteResult(
        kind=mode,
        teams=[
            ResultTeam(label=f"{state.organizers[0]} チーム", players=[state.organizers[0], spin_order[0]]),
            ResultTeam(label=f"{state.organizers[1]} チーム", players=[state.organizers[1], spin_order[1]]),
        ],
    )


def apply_draw_result(selected: List[str], spin_order: List[str], selection_reasons: Dict[str, str], result: RouletteResult):
    organizers = organizer_set()
    new_miss: Dict[str, int] = {}
    new_participation_counts: Dict[str, int] = {}

    for player in state.participants:
        if player in organizers:
            new_miss[player] = state.miss_counts.get(player, 0)
            new_participation_counts[player] = state.participation_counts.get(player, 0)
            continue

        new_miss[player] = 0 if player in selected else state.miss_counts.get(player, 0) + 1
        new_participation_counts[player] = state.participation_counts.get(player, 0) + (1 if player in selected else 0)

    state.prev_players = state.last_players
    state.last_players = selected
    state.spin_order = spin_order
    state.miss_counts = new_miss
    state.participation_counts = new_participation_counts
    state.auto_forced_players = compute_auto_forced_players(state.forced_players)
    state.last_selection_reasons = {
        player: selection_reasons[player]
        for player in selected
        if player in selection_reasons
    }
    state.result = result
    state.round_id = str(uuid.uuid4())
    state.phase = "spinning"


@app.get("/state")
def get_state():
    return state


@app.post("/participants")
def set_participants(req: ParticipantsRequest):
    state.participants = sanitize_names(req.participants, limit=1000)
    organizers = organizer_set()

    state.forced_players = [p for p in state.forced_players if p in state.participants and p not in organizers][:2]
    state.excluded_players = [p for p in state.excluded_players if p in state.participants and p not in organizers]
    state.last_players = [p for p in state.last_players if p in state.participants and p not in organizers]
    state.prev_players = [p for p in state.prev_players if p in state.participants and p not in organizers]
    state.spin_order = [p for p in state.spin_order if p in state.participants and p not in organizers]
    state.miss_counts = {p: state.miss_counts.get(p, 0) for p in state.participants}
    state.participation_counts = {p: state.participation_counts.get(p, 0) for p in state.participants}
    state.auto_forced_players = compute_auto_forced_players(state.forced_players)

    return {"ok": True}


@app.post("/organizer_config")
def set_organizer_config(req: OrganizerConfigRequest):
    limit = 1 if req.organizer_mode == "single" else 2
    state.organizer_mode = req.organizer_mode
    state.organizers = sanitize_names(req.organizers, limit=limit)

    organizers = organizer_set()
    state.forced_players = [p for p in state.forced_players if p not in organizers][:2]
    state.excluded_players = [p for p in state.excluded_players if p not in organizers]
    state.auto_forced_players = compute_auto_forced_players(state.forced_players)
    return {"ok": True}


@app.post("/forced_players")
def set_forced_players(req: ForcedPlayersRequest):
    unique: List[str] = []
    organizers = organizer_set()
    for player in req.forced_players:
        if player in state.participants and player not in organizers and player not in unique:
            unique.append(player)

    state.forced_players = unique[:2]
    state.auto_forced_players = compute_auto_forced_players(state.forced_players)
    return {"ok": True}


@app.post("/excluded_players")
def set_excluded_players(req: ExcludedPlayersRequest):
    unique: List[str] = []
    organizers = organizer_set()
    for player in req.excluded_players:
        if player in state.participants and player not in organizers and player not in unique:
            unique.append(player)

    state.excluded_players = unique
    state.auto_forced_players = compute_auto_forced_players(state.forced_players)
    return {"ok": True}


@app.post("/draw")
def draw(req: DrawRequest):
    validate_draw_mode(req.mode)

    required_count = 2 if req.mode in ("hosts_vs_duo", "hosts_split_pairs") else int(req.mode[-1])
    selected, spin_order, selection_reasons = select_players(required_count)
    result = build_result(req.mode, spin_order)
    apply_draw_result(selected, spin_order, selection_reasons, result)

    return {"round_id": state.round_id, "result": result}


@app.post("/presentation_complete")
def presentation_complete(req: PresentationCompleteRequest):
    if req.round_id != state.round_id:
        return {"ok": False, "reason": "round_id_mismatch"}

    state.phase = "result"
    return {"ok": True}


@app.post("/reset")
def reset():
    reset_state()
    return {"ok": True}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            payload = state.model_dump() if hasattr(state, "model_dump") else state.dict()
            await ws.send_json(payload)
            await asyncio.sleep(0.1)
    except Exception:
        pass
