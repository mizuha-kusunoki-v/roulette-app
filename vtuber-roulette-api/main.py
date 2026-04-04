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
    selected_organizer_index: int = 0
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
    selected_organizer_index: int = 0


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


def active_organizers() -> List[str]:
    if state.organizer_mode == "double":
        return state.organizers[:2]

    if not state.organizers:
        return []

    index = state.selected_organizer_index
    if index < 0 or index >= len(state.organizers):
        index = 0
    return [state.organizers[index]]


def organizer_set() -> set[str]:
    return set(active_organizers())


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

    if state.organizer_mode == "double" and len(active_organizers()) < 2:
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
    current_organizers = active_organizers()

    if mode == "standard_3":
        team_a_players = [spin_order[0]]
        if current_organizers:
            team_a_players = [current_organizers[0], spin_order[0]]

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
                ResultTeam(label="主催チーム", players=current_organizers[:2]),
                ResultTeam(label="挑戦者チーム", players=spin_order[:2]),
            ],
        )

    return RouletteResult(
        kind=mode,
        teams=[
            ResultTeam(label=f"{current_organizers[0]} チーム", players=[current_organizers[0], spin_order[0]]),
            ResultTeam(label=f"{current_organizers[1]} チーム", players=[current_organizers[1], spin_order[1]]),
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
    state.organizer_mode = req.organizer_mode
    state.organizers = sanitize_names(req.organizers, limit=2)
    state.selected_organizer_index = 1 if req.selected_organizer_index == 1 and len(state.organizers) > 1 else 0

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


# =============================================================================
# 縛りルーレット (Restriction Roulette)
# =============================================================================


class RestrictionItem(BaseModel):
    id: str
    name: str
    description: str = ""
    enabled: bool = True
    weight: int = 1  # 出現重み 1〜5
    use_count: int = 0


class RestrictionState(BaseModel):
    items: List[RestrictionItem] = []
    result: RestrictionItem | None = None
    target: str = ""                  # 適用対象テキスト (例: "チームA", "全員")
    phase: Literal["idle", "spinning", "result"] = "idle"
    round_id: str | None = None
    history: List[str] = []          # 選択済み item.id の履歴 (新しい順)
    exclude_recent_count: int = 0    # 直近 N 回を抽選除外 (0=除外なし)
    spin_order: List[str] = []       # アニメーション用 item.name リスト


restriction_state = RestrictionState()


class RestrictionItemsRequest(BaseModel):
    items: List[RestrictionItem]


class RestrictionSpinRequest(BaseModel):
    target: str = ""


class RestrictionPresentationCompleteRequest(BaseModel):
    round_id: str


class RestrictionExcludeRecentRequest(BaseModel):
    exclude_recent_count: int


def pick_restriction_item(
    items: List[RestrictionItem],
    exclude_ids: set,
) -> RestrictionItem | None:
    """有効アイテムから重み付きランダム抽選。除外対象が全てを覆う場合はフォールバック。"""
    eligible = [i for i in items if i.enabled and i.id not in exclude_ids]
    if not eligible:
        # フォールバック：除外ルールを無視して有効アイテム全体から選ぶ
        eligible = [i for i in items if i.enabled]
    if not eligible:
        return None
    weights = [max(1, i.weight) for i in eligible]
    return random.choices(eligible, weights=weights, k=1)[0]


@app.get("/restriction/state")
def get_restriction_state():
    return restriction_state


@app.post("/restriction/items")
def set_restriction_items(req: RestrictionItemsRequest):
    # 既存の use_count を引き継ぐ
    existing_counts = {i.id: i.use_count for i in restriction_state.items}
    for item in req.items:
        item.use_count = existing_counts.get(item.id, item.use_count)
    restriction_state.items = req.items
    return {"ok": True}


@app.post("/restriction/spin")
def restriction_spin(req: RestrictionSpinRequest):
    if restriction_state.phase == "spinning":
        raise HTTPException(status_code=400, detail="already spinning")

    exclude_ids: set = set()
    if restriction_state.exclude_recent_count > 0:
        exclude_ids = set(restriction_state.history[-restriction_state.exclude_recent_count:])

    selected = pick_restriction_item(restriction_state.items, exclude_ids)
    if not selected:
        raise HTTPException(status_code=400, detail="no eligible items")

    # ルーレット盤に並べる名前リスト (有効アイテムのみ・シャッフル済み)
    eligible_names = [i.name for i in restriction_state.items if i.enabled]
    random.shuffle(eligible_names)
    if selected.name not in eligible_names:
        eligible_names.append(selected.name)

    restriction_state.result = selected.model_copy()
    restriction_state.target = req.target
    restriction_state.spin_order = eligible_names
    restriction_state.round_id = str(uuid.uuid4())
    restriction_state.phase = "spinning"

    return {"round_id": restriction_state.round_id}


@app.post("/restriction/presentation_complete")
def restriction_presentation_complete(req: RestrictionPresentationCompleteRequest):
    if req.round_id != restriction_state.round_id:
        return {"ok": False, "reason": "round_id_mismatch"}

    if restriction_state.result:
        restriction_state.history.append(restriction_state.result.id)
        for item in restriction_state.items:
            if item.id == restriction_state.result.id:
                item.use_count += 1
                break

    restriction_state.phase = "result"
    return {"ok": True}


@app.post("/restriction/exclude_recent")
def set_restriction_exclude_recent(req: RestrictionExcludeRecentRequest):
    restriction_state.exclude_recent_count = max(0, req.exclude_recent_count)
    return {"ok": True}


@app.post("/restriction/reset")
def restriction_reset():
    global restriction_state
    restriction_state = RestrictionState(
        items=restriction_state.items,
        history=restriction_state.history,
        exclude_recent_count=restriction_state.exclude_recent_count,
    )
    return {"ok": True}


@app.websocket("/restriction/ws")
async def restriction_websocket_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            payload = (
                restriction_state.model_dump()
                if hasattr(restriction_state, "model_dump")
                else restriction_state.dict()
            )
            await ws.send_json(payload)
            await asyncio.sleep(0.1)
    except Exception:
        pass
