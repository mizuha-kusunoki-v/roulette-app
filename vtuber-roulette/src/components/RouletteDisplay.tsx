import { RouletteResult } from "../types";

export const RouletteDisplay = ({ result }: { result: RouletteResult | null }) => {
  if (!result) return <p>抽選結果はまだありません。</p>;

  return (
    <div>
      <h2>抽選結果</h2>
      <p>チームA: {result.teamA.join(", ")}</p>
      <p>チームB: {result.teamB.join(", ")}</p>
    </div>
  );
};
