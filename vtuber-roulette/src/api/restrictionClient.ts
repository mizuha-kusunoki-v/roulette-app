import { RestrictionItem, RestrictionState } from "../types";

const BASE_URL = "http://localhost:8000";

async function ensureOk(res: Response) {
  if (res.ok) return;

  let message = "リクエストに失敗しました。";
  try {
    const data = await res.json();
    message = data.detail ?? data.reason ?? message;
  } catch {
    message = res.statusText || message;
  }
  throw new Error(message);
}

export async function fetchRestrictionState(): Promise<RestrictionState> {
  const res = await fetch(`${BASE_URL}/restriction/state`);
  await ensureOk(res);
  return res.json();
}

export async function updateRestrictionItems(items: RestrictionItem[]) {
  const res = await fetch(`${BASE_URL}/restriction/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  await ensureOk(res);
}

export async function restrictionSpin(target: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/restriction/spin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target }),
  });
  await ensureOk(res);
  const data = await res.json();
  return data.round_id as string;
}

export async function restrictionPresentationComplete(roundId: string) {
  const res = await fetch(`${BASE_URL}/restriction/presentation_complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ round_id: roundId }),
  });
  await ensureOk(res);
}

export async function setRestrictionExcludeRecent(excludeRecentCount: number) {
  const res = await fetch(`${BASE_URL}/restriction/exclude_recent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exclude_recent_count: excludeRecentCount }),
  });
  await ensureOk(res);
}

export async function resetRestrictionState() {
  const res = await fetch(`${BASE_URL}/restriction/reset`, {
    method: "POST",
  });
  await ensureOk(res);
}
