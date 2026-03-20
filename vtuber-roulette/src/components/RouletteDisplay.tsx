import { OrganizerMode, RouletteResult } from "../types";
import { getDisplayTeams } from "../utils/resultDisplay";

export const RouletteDisplay = ({
  result,
  organizers = [],
  organizerMode = "single",
  selectedOrganizerIndex = 0,
}: {
  result: RouletteResult | null;
  organizers?: string[];
  organizerMode?: OrganizerMode;
  selectedOrganizerIndex?: number;
}) => {
  if (!result) return <p>抽選結果はまだありません。</p>;

  const teams = getDisplayTeams(
    result,
    organizers,
    organizerMode,
    selectedOrganizerIndex,
  );

  return (
    <div>
      <h2>抽選結果</h2>
      {teams.map((team) => (
        <p key={team.label}>
          {team.label}: {team.players.join(", ")}
        </p>
      ))}
    </div>
  );
};
