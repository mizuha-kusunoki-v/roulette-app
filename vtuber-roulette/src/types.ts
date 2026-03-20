export type RouletteResult = {
  teamA: string[];
  teamB: string[];
};

export type RouletteState = {
  participants: string[];
  forced_players: string[];
  auto_forced_players: string[];
  excluded_players: string[];
  participation_counts: Record<string, number>;
  prev_players: string[];
  last_players: string[];
  miss_counts: Record<string, number>;
  last_selection_reasons: Record<string, string>;
  result: RouletteResult | null;
  round_id: string | null;
  phase: "idle" | "result";
};
