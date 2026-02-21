import { RouletteState } from "../types";

const BASE_URL = "http://localhost:8000";

export async function fetchState(): Promise<RouletteState> {
  const res = await fetch(`${BASE_URL}/state`);
  return res.json();
}

export async function updateParticipants(participants: string[]) {
  await fetch(`${BASE_URL}/participants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participants }),
  });
}

export async function updateForcedPlayers(forcedPlayers: string[]) {
  await fetch(`${BASE_URL}/forced_players`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ forced_players: forcedPlayers }),
  });
}

export async function draw(count: number) {
  const res = await fetch(`${BASE_URL}/draw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count }),
  });

  const data = await res.json();
  return data.result;
}
