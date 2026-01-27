import { RouletteState, RouletteResult } from "../types";

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

export async function draw(count: number) {
  const res = await fetch(`${BASE_URL}/draw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count }),
  });

  const data = await res.json();

  // ★ 管理画面では「result」だけ使う
  return data.result;
}