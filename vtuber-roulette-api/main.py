from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Literal
import asyncio
import random
import statistics
import uuid

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


class RouletteState(BaseModel):
    participants: List[str] = []
    forced_players: List[str] = []
    auto_forced_players: List[str] = []
    participation_counts: Dict[str, int] = {}
    prev_players: List[str] = []
    last_players: List[str] = []
    miss_counts: Dict[str, int] = {}
    last_selection_reasons: Dict[str, str] = {}
    result: Dict | None = None
    round_id: str | None = None
    phase: Literal["idle", "result"] = "idle"


state = RouletteState()


class ParticipantsRequest(BaseModel):
    participants: List[str]


class ForcedPlayersRequest(BaseModel):
    forced_players: List[str]


class DrawRequest(BaseModel):
    count: int  # 3 or 4


def compute_auto_forced_players(
    manual_forced: List[str],
    excluded_players: List[str] | None = None,
) -> List[str]:
    if not ENABLE_AUTO_FORCE_BY_MEDIAN_GAP or not state.participants:
        return []

    excluded_set = set(excluded_players or [])
    participant_counts = [state.participation_counts.get(p, 0) for p in state.participants]
    median_count = statistics.median(participant_counts)
    threshold = median_count - AUTO_FORCE_MEDIAN_GAP

    auto_forced = [
        p
        for p in state.participants
        if p not in manual_forced
        and p not in state.last_players
        and p not in excluded_set
        and state.miss_counts.get(p, 0) < 3
        and state.participation_counts.get(p, 0) <= threshold
    ]
    auto_forced.sort(key=lambda p: (state.participation_counts.get(p, 0), p))
    if AUTO_FORCE_MAX_PER_DRAW > 0:
        auto_forced = auto_forced[:AUTO_FORCE_MAX_PER_DRAW]
    return auto_forced


@app.get("/state")
def get_state():
    return state


@app.post("/participants")
def set_participants(req: ParticipantsRequest):
    state.participants = req.participants

    state.forced_players = [p for p in state.forced_players if p in state.participants][:2]
    state.last_players = [p for p in state.last_players if p in state.participants]
    state.miss_counts = {p: state.miss_counts.get(p, 0) for p in state.participants}
    state.participation_counts = {p: state.participation_counts.get(p, 0) for p in state.participants}
    state.auto_forced_players = compute_auto_forced_players(state.forced_players)

    return {"ok": True}


@app.post("/forced_players")
def set_forced_players(req: ForcedPlayersRequest):
    unique: List[str] = []
    for p in req.forced_players:
        if p in state.participants and p not in unique:
            unique.append(p)

    state.forced_players = unique[:2]
    state.auto_forced_players = compute_auto_forced_players(state.forced_players)
    return {"ok": True}


@app.post("/draw")
def draw(req: DrawRequest):
    count = req.count
    selection_reasons: Dict[str, str] = {}

    def append_with_reason(candidates: List[str], reason: str, need: int):
        if need <= 0:
            return []
        picked = candidates[:need]
        for p in picked:
            if p not in selection_reasons:
                selection_reasons[p] = reason
        return picked

    # 1) manual check first (even if last round)
    manual_forced = [p for p in state.forced_players if p in state.participants][:2]
    selected = append_with_reason(manual_forced, "manual_check", count)

    # 2) non-checked players in last round are excluded for normal selection
    available = [p for p in state.participants if p not in state.last_players and p not in selected]

    # 3) prioritize 3+ misses
    guaranteed = [p for p in available if state.miss_counts.get(p, 0) >= 3]
    selected += append_with_reason(guaranteed, "miss_3", count - len(selected))

    # 4) then median-gap auto-force (within currently eligible players)
    auto_forced = compute_auto_forced_players(manual_forced, selected)
    selected += append_with_reason(auto_forced, "median_gap", count - len(selected))

    # fill randomly from eligible players
    if len(selected) < count:
        pool = [p for p in available if p not in selected]
        random.shuffle(pool)
        selected += append_with_reason(pool, "random", count - len(selected))

    # exception rule: if still short, allow last-round players
    if len(selected) < count and state.last_players:
        prev_pool = [p for p in state.last_players if p not in selected]
        random.shuffle(prev_pool)
        selected += append_with_reason(prev_pool, "exception_prev_round", count - len(selected))

    selected_random = selected.copy()
    random.shuffle(selected_random)

    if count == 3:
        result = {
            "teamA": [selected_random[0]],
            "teamB": [selected_random[1], selected_random[2]],
        }
    else:
        result = {
            "teamA": [selected_random[0], selected_random[1]],
            "teamB": [selected_random[2], selected_random[3]],
        }

    new_miss: Dict[str, int] = {}
    new_participation_counts: Dict[str, int] = {}
    for p in state.participants:
        new_miss[p] = 0 if p in selected else state.miss_counts.get(p, 0) + 1
        new_participation_counts[p] = state.participation_counts.get(p, 0) + (1 if p in selected else 0)

    state.prev_players = state.last_players
    state.last_players = selected
    state.miss_counts = new_miss
    state.participation_counts = new_participation_counts
    state.auto_forced_players = compute_auto_forced_players(state.forced_players)
    state.last_selection_reasons = {
        p: selection_reasons[p]
        for p in selected
        if p in selection_reasons
    }
    state.result = result
    state.round_id = str(uuid.uuid4())
    state.phase = "result"

    return {"round_id": state.round_id, "result": result}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            await ws.send_json(state.dict())
            await asyncio.sleep(0.1)
    except Exception:
        pass
