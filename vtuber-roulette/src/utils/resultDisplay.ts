import { RouletteResult, RouletteResultTeam } from "../types";

export function getActiveOrganizers(
  organizerMode: "single" | "double",
  organizers: string[],
  selectedOrganizerIndex = 0,
): string[] {
  if (organizerMode === "double") {
    return organizers.slice(0, 2);
  }

  if (organizers.length === 0) {
    return [];
  }

  const index = selectedOrganizerIndex === 1 && organizers[1] ? 1 : 0;
  return organizers[index] ? [organizers[index]] : [];
}

export function getDisplayTeams(
  result: RouletteResult | null,
  organizers: string[] = [],
  organizerMode: "single" | "double" = "single",
  selectedOrganizerIndex = 0,
): RouletteResultTeam[] {
  if (!result) {
    return [];
  }

  const activeOrganizers = getActiveOrganizers(
    organizerMode,
    organizers,
    selectedOrganizerIndex,
  );

  if (
    result.kind === "standard_3" &&
    activeOrganizers[0] &&
    result.teams[0] &&
    result.teams[0].players.length === 1
  ) {
    return [
      {
        ...result.teams[0],
        players: [activeOrganizers[0], result.teams[0].players[0]],
      },
      ...result.teams.slice(1),
    ];
  }

  return result.teams;
}
