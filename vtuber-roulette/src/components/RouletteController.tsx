import { draw } from "../api/client";
import { DrawMode, OrganizerMode, RouletteResult } from "../types";

interface Props {
  organizerMode: OrganizerMode;
  organizers: string[];
  onResult: (r: RouletteResult) => void;
  onUpdated: () => void;
  disabled?: boolean;
}

export const RouletteController = ({
  organizerMode,
  organizers,
  onResult,
  onUpdated,
  disabled = false,
}: Props) => {
  const hasTwoHosts = organizers.filter((name) => name.trim()).length >= 2;
  const hostDrawDisabled = disabled || !hasTwoHosts;

  const exec = async (mode: DrawMode) => {
    if (disabled) return;

    try {
      const result = await draw(mode);
      onResult(result);
      onUpdated();
    } catch (error) {
      const message = error instanceof Error ? error.message : "抽選に失敗しました。";
      window.alert(message);
    }
  };

  return (
    <div>
      <h2>抽選</h2>
      {organizerMode === "single" ? (
        <>
          <button onClick={() => exec("standard_3")} disabled={disabled}>3人抽選</button>
          <button onClick={() => exec("standard_4")} disabled={disabled}>4人抽選</button>
        </>
      ) : (
        <>
          <button onClick={() => exec("hosts_vs_duo")} disabled={hostDrawDisabled}>
            主催2人 vs 抽選2人
          </button>
          <button onClick={() => exec("hosts_split_pairs")} disabled={hostDrawDisabled}>
            主催別チームのペア抽選
          </button>
          {!hasTwoHosts && <p>主催2人モードでは主催名を2人分保存してください。</p>}
        </>
      )}
    </div>
  );
};
