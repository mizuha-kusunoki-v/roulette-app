import { useState } from "react";
import { restrictionSpin, setRestrictionExcludeRecent } from "../api/restrictionClient";
import { RestrictionItem } from "../types";

interface Props {
  phase: "idle" | "spinning" | "result";
  result: RestrictionItem | null;
  target: string;
  excludeRecentCount: number;
  disabled: boolean;
  onUpdated: () => void;
}

export const RestrictionController = ({
  phase,
  result,
  target,
  excludeRecentCount,
  disabled,
  onUpdated,
}: Props) => {
  const [targetInput, setTargetInput] = useState(target);
  const [excludeInput, setExcludeInput] = useState(String(excludeRecentCount));
  const [error, setError] = useState<string | null>(null);

  const handleSpin = async () => {
    try {
      setError(null);
      await restrictionSpin(targetInput.trim());
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleExcludeChange = async (value: string) => {
    setExcludeInput(value);
    const n = Math.max(0, Number(value) || 0);
    try {
      await setRestrictionExcludeRecent(n);
      onUpdated();
    } catch {
      // ignore
    }
  };

  const isSpinning = phase === "spinning";
  const canSpin = !disabled && !isSpinning;

  return (
    <section className="rc-section">
      <h2 className="rc-section-title">縛りルーレット</h2>

      {error && <p className="rc-error">{error}</p>}

      {/* 適用対象 */}
      <div className="rc-row">
        <label className="rc-label">適用対象</label>
        <input
          className="rc-input"
          value={targetInput}
          onChange={(e) => setTargetInput(e.target.value)}
          placeholder="例: チームA / 全員"
          disabled={isSpinning}
        />
      </div>

      {/* 直近除外設定 */}
      <div className="rc-row">
        <label className="rc-label">直近 N 回を除外</label>
        <input
          className="rc-input rc-input--narrow"
          type="number"
          min={0}
          max={99}
          value={excludeInput}
          onChange={(e) => handleExcludeChange(e.target.value)}
          disabled={isSpinning}
        />
        <span className="rc-unit">回</span>
      </div>

      {/* スピンボタン */}
      <button
        className="rc-spin-btn"
        onClick={handleSpin}
        disabled={!canSpin}
      >
        {isSpinning ? "抽選中..." : phase === "result" ? "再スピン" : "スピン！"}
      </button>

      {/* 結果表示 (Admin 確認用) */}
      {phase === "result" && result && (
        <div className="rc-result">
          <p className="rc-result-label">抽選結果</p>
          {target && <p className="rc-result-target">対象: {target}</p>}
          <p className="rc-result-name">{result.name}</p>
          {result.description && (
            <p className="rc-result-desc">{result.description}</p>
          )}
        </div>
      )}
    </section>
  );
};
