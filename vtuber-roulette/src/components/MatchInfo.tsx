import { RouletteState } from "../types";

export const MatchInfo = ({ state }: { state: RouletteState }) => {
  const guaranteed = Object.entries(state.miss_counts)
    .filter(([_, c]) => c >= 3)
    .map(([n]) => n);

  return (
    <div>
      <h3>前回参加者</h3>
      {state.prev_players.length ? state.prev_players.join(", ") : "なし"}

      <h3>次回確定（3回未抽選）</h3>
      {guaranteed.length ? guaranteed.join(", ") : "なし"}
    </div>
  );
};