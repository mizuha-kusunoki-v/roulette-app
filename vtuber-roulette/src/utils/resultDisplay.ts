import { RouletteResult, RouletteResultTeam } from "../types";

export function getDisplayTeams(
  result: RouletteResult | null,
  organizers: string[] = [],
): RouletteResultTeam[] {
  if (!result) {
    return [];
  }

  if (
    result.kind === "standard_3" &&
    organizers[0] &&
    result.teams[0] &&
    result.teams[0].players.length === 1
  ) {
    return [
      {
        ...result.teams[0],
        players: [organizers[0], result.teams[0].players[0]],
      },
      ...result.teams.slice(1),
    ];
  }

  return result.teams;
}
