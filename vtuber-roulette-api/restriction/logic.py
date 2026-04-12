import random
from typing import List, Set

from .models import RestrictionItem, RestrictionState

# ── グローバル状態 ─────────────────────────────────────────────────────────────

restriction_state = RestrictionState()


# ── 抽選ロジック ───────────────────────────────────────────────────────────────

def pick_restriction_item(
    items: List[RestrictionItem],
    exclude_ids: Set[str],
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
