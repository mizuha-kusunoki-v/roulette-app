import { useEffect, useRef, useState } from "react";
import { restrictionPresentationComplete } from "../api/restrictionClient";
import { RestrictionState } from "../types";
import { CanvasRoulette } from "./CanvasRoulette";
import "./roulette.css";

/**
 * 縛りルーレット アニメーション専用 Viewer
 * OBS Browser Source: /viewer/restriction/roulette
 * spinning フェーズ中のみ表示。アニメーション完了後に presentation_complete を通知する。
 */
export const RestrictionViewerPage = () => {
  const [serverState, setServerState] = useState<RestrictionState | null>(null);
  const [uiStatus, setUiStatus] = useState<"idle" | "running">("idle");

  const lastRoundIdRef = useRef<string | null>(null);
  const completedRoundIdRef = useRef<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:8000/restriction/ws");
    ws.onmessage = (e) => {
      const incoming = JSON.parse(e.data) as RestrictionState;
      setServerState(incoming);
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    if (!serverState?.round_id || !serverState.result) return;

    if (serverState.phase !== "spinning") {
      if (uiStatus !== "idle") setUiStatus("idle");
      return;
    }

    if (serverState.round_id === lastRoundIdRef.current) return;

    lastRoundIdRef.current = serverState.round_id;
    setUiStatus("running");
  }, [serverState, uiStatus]);

  if (
    !serverState ||
    serverState.phase !== "spinning" ||
    uiStatus !== "running" ||
    !serverState.result
  ) {
    return <div className="viewer-screen" />;
  }

  const spinOrder = serverState.spin_order;
  const winnerName = serverState.result.name;
  const winnerIdx = spinOrder.indexOf(winnerName);
  const safeIdx = winnerIdx >= 0 ? winnerIdx : spinOrder.length - 1;
  const safeOrder = winnerIdx >= 0 ? spinOrder : [...spinOrder, winnerName];

  return (
    <div className="viewer-screen viewer-center">
      <p className="roulette-status">縛りルーレット抽選中...</p>
      <CanvasRoulette
        key={serverState.round_id}
        participants={safeOrder}
        winnerIndex={safeIdx}
        onFinish={async () => {
          setUiStatus("idle");
          if (
            serverState.round_id &&
            completedRoundIdRef.current !== serverState.round_id
          ) {
            completedRoundIdRef.current = serverState.round_id;
            await restrictionPresentationComplete(serverState.round_id);
          }
        }}
      />
    </div>
  );
};
