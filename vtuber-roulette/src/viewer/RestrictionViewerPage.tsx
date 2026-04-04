import { useEffect, useRef, useState } from "react";
import { restrictionPresentationComplete } from "../api/restrictionClient";
import { RestrictionState } from "../types";
import { CanvasRoulette } from "./CanvasRoulette";
import "./roulette.css";
import "./restriction-viewer.css";

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

  // ---- 待機 / スピン中 ----
  if (!serverState || serverState.phase === "idle") {
    return <div className="viewer-screen" />;
  }

  if (serverState.phase === "spinning" && uiStatus === "running" && serverState.result) {
    const spinOrder = serverState.spin_order;
    const winnerName = serverState.result.name;
    const winnerIdx = spinOrder.indexOf(winnerName);
    // spin_order に winner が含まれていない場合は末尾にフォールバック
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
  }

  // ---- 結果表示 ----
  if (serverState.phase === "result" && serverState.result) {
    const { name, description } = serverState.result;
    const { target } = serverState;

    return (
      <div className="viewer-screen viewer-center">
        <div className="rv-result-panel">
          <p className="rv-result-eyebrow">縛りルール決定！</p>
          {target && <p className="rv-result-target">{target}</p>}
          <p className="rv-result-name">{name}</p>
          {description && <p className="rv-result-desc">{description}</p>}
        </div>
      </div>
    );
  }

  return <div className="viewer-screen" />;
};
