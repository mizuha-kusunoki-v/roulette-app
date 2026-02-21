import { RouletteState } from "../types";

const REASON_LABEL: Record<string, string> = {
  manual_check: "手動チェック",
  miss_3: "3回連続未抽選",
  median_gap: "中央値乖離",
  random: "通常抽選",
  exception_prev_round: "人数不足時の前回参加者補充",
};

export const MatchInfo = ({ state }: { state: RouletteState }) => {
  const guaranteed = Object.entries(state.miss_counts)
    .filter(([_, c]) => c >= 3)
    .map(([n]) => n);

  const grouped = Object.entries(state.last_selection_reasons).reduce(
    (acc, [name, reason]) => {
      if (!acc[reason]) acc[reason] = [];
      acc[reason].push(name);
      return acc;
    },
    {} as Record<string, string[]>
  );

  return (
    <div>
      <h3>前回参加者</h3>
      <p>{state.prev_players.length ? state.prev_players.join(", ") : "なし"}</p>

      <h3>次回の強制抽選候補（3回連続未抽選）</h3>
      <p>{guaranteed.length ? guaranteed.join(", ") : "なし"}</p>

      <h3>自動強制対象（参加回数の中央値乖離）</h3>
      <p>{state.auto_forced_players.length ? state.auto_forced_players.join(", ") : "なし"}</p>

      <h3>直近抽選の内訳</h3>
      {Object.keys(grouped).length === 0 ? (
        <p>なし</p>
      ) : (
        <ul>
          {Object.entries(grouped).map(([reason, names]) => (
            <li key={reason}>
              {REASON_LABEL[reason] ?? reason}: {names.join(", ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
