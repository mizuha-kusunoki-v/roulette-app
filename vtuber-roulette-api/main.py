from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Literal
import random
import uuid
import asyncio
import random

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# State（Single Source）
# =========================

class RouletteState(BaseModel):
    participants: List[str] = []
    prev_players: list[str] = []   # ★ 前回参加者（除外用）
    last_players: list[str] = []   # ★ 今回結果
    miss_counts: Dict[str, int] = {}
    result: Dict | None = None
    round_id: str | None = None
    phase: Literal["idle", "result"] = "idle"


state = RouletteState()

# =========================
# Request Models
# =========================

class ParticipantsRequest(BaseModel):
    participants: List[str]


class DrawRequest(BaseModel):
    count: int  # 3 or 4

# =========================
# REST API
# =========================

@app.get("/state")
def get_state():
    return state


@app.post("/participants")
def set_participants(req: ParticipantsRequest):
    state.participants = req.participants

    # 状態クリーンアップ
    state.last_players = [
        p for p in state.last_players if p in state.participants
    ]
    state.miss_counts = {
        p: state.miss_counts.get(p, 0)
        for p in state.participants
    }

    return {"ok": True}


@app.post("/draw")
def draw(req: DrawRequest):
    count = req.count

    available = [
        p for p in state.participants
        if p not in state.last_players
    ]

    # 3回未抽選 → 強制当選
    guaranteed = [
        p for p in available
        if state.miss_counts.get(p, 0) >= 3
    ]

    selected = guaranteed[:count]

    # ====== ⬇️ ここから新ロジック追加 ======
    if len(selected) < count:
        # 抽選プール（前回参加者除外）
        pool = [p for p in available if p not in selected]

        # 通常抽選
        random.shuffle(pool)
        selected += pool[: (count - len(selected))]

    # まだ不足している場合 → 前回参加者から補充
    if len(selected) < count and state.last_players:
        prev_pool = [p for p in state.last_players if p not in selected]
        random.shuffle(prev_pool)
        fill_needed = count - len(selected)
        selected += prev_pool[:fill_needed]

    # ====== ⬆️ 追加ここまで ======
    selected_random = selected.copy()
    random.shuffle(selected_random)
    # チーム分け
    if count == 3:
        result = {
            "teamA": [selected_random[0]],
            "teamB": [selected_random[1], selected_random[2]],
        }
    else:  # count == 4
        result = {
            "teamA": [selected_random[0], selected_random[1]],
            "teamB": [selected_random[2], selected_random[3]],
        }

    # miss count 更新
    new_miss = {}
    for p in state.participants:
        new_miss[p] = 0 if p in selected else state.miss_counts.get(p, 0) + 1

    state.prev_players = state.last_players
    state.last_players = selected
    state.miss_counts = new_miss
    state.result = result
    state.round_id = str(uuid.uuid4())
    state.phase = "result"

    return {"round_id": state.round_id, "result": result}

# =========================
# WebSocket（状態配信）
# =========================

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            await ws.send_json(state.dict())
            await asyncio.sleep(0.1)
    except Exception:
        pass