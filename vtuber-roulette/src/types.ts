export type RouletteResult = {
  teamA: string[];
  teamB: string[];
};

export type RouletteState = {
  participants: string[];
  prev_players: string[];
  last_players: string[];
  miss_counts: Record<string, number>;
  result: RouletteResult | null;

  // ★ 追加：抽選ラウンドID（毎回変わる）
  round_id: string | null;

  // ★ Backend と完全一致（時間概念なし）
  phase: "idle" | "result";
};