from typing import List, Literal

from pydantic import BaseModel


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
    history: List[str] = []          # 選択済み item.id の履歴
    exclude_recent_count: int = 0    # 直近 N 回を抽選除外 (0=除外なし)
    spin_order: List[str] = []       # アニメーション用 item.name リスト


# ── リクエストモデル ──────────────────────────────────────────────────────────

class RestrictionItemsRequest(BaseModel):
    items: List[RestrictionItem]


class RestrictionSpinRequest(BaseModel):
    target: str = ""


class RestrictionPresentationCompleteRequest(BaseModel):
    round_id: str


class RestrictionExcludeRecentRequest(BaseModel):
    exclude_recent_count: int
