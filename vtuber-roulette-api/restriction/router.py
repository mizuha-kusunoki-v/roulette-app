import asyncio
import random
import uuid

from fastapi import APIRouter, HTTPException, WebSocket

from .logic import pick_restriction_item, restriction_state
from .models import (
    RestrictionExcludeRecentRequest,
    RestrictionItemsRequest,
    RestrictionPresentationCompleteRequest,
    RestrictionSpinRequest,
    RestrictionState,
)

router = APIRouter(prefix="/restriction")


@router.get("/state")
def get_restriction_state():
    return restriction_state


@router.post("/items")
def set_restriction_items(req: RestrictionItemsRequest):
    # 既存の use_count を引き継ぐ
    existing_counts = {i.id: i.use_count for i in restriction_state.items}
    for item in req.items:
        item.use_count = existing_counts.get(item.id, item.use_count)
    restriction_state.items = req.items
    return {"ok": True}


@router.post("/spin")
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


@router.post("/presentation_complete")
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


@router.post("/exclude_recent")
def set_restriction_exclude_recent(req: RestrictionExcludeRecentRequest):
    restriction_state.exclude_recent_count = max(0, req.exclude_recent_count)
    return {"ok": True}


@router.post("/reset")
def restriction_reset():
    global restriction_state
    restriction_state = RestrictionState(
        items=restriction_state.items,
        history=restriction_state.history,
        exclude_recent_count=restriction_state.exclude_recent_count,
    )
    return {"ok": True}


@router.websocket("/ws")
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
