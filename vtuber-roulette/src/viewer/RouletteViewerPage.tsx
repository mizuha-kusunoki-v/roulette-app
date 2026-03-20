import { useEffect, useRef, useState } from "react";
import { notifyPresentationComplete } from "../api/client";
import { RouletteState } from "../types";
import { CanvasRoulette } from "./CanvasRoulette";
import "./roulette.css";

const EXCEPTION_REASON = "exception_prev_round";

export const RouletteViewerPage = () => {
  const [spinOrder, setSpinOrder] = useState<string[]>([]);
  const [normalParticipants, setNormalParticipants] = useState<string[]>([]);
  const [exceptionParticipants, setExceptionParticipants] = useState<string[]>([]);
  const [serverState, setServerState] = useState<RouletteState | null>(null);
  const [uiStatus, setUiStatus] = useState<"idle" | "running">("idle");
  const [spinIndex, setSpinIndex] = useState(0);

  const lastRoundIdRef = useRef<string | null>(null);
  const completedRoundIdRef = useRef<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:8000/ws");

    ws.onmessage = (e) => {
      const incoming = JSON.parse(e.data) as RouletteState;
      setServerState(incoming);
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    if (!serverState?.round_id || !serverState.result) {
      return;
    }

    if (serverState.phase !== "spinning") {
      if (uiStatus !== "idle") {
        setUiStatus("idle");
      }
      return;
    }

    if (serverState.round_id === lastRoundIdRef.current) {
      return;
    }

    lastRoundIdRef.current = serverState.round_id;
    setSpinOrder(serverState.spin_order);

    const organizerSet = new Set(serverState.organizers);
    const normalPool = serverState.participants.filter(
      (player) => !organizerSet.has(player) && !serverState.prev_players.includes(player)
    );
    const exceptionPool = serverState.participants.filter(
      (player) => !organizerSet.has(player) && serverState.prev_players.includes(player)
    );

    setNormalParticipants(normalPool);
    setExceptionParticipants(exceptionPool);
    setSpinIndex(0);
    setUiStatus("running");
  }, [serverState, uiStatus]);

  if (!serverState || serverState.phase !== "spinning" || uiStatus !== "running") {
    return <div className="viewer-screen" />;
  }

  const completed = spinOrder.slice(0, spinIndex);
  const currentWinner = spinOrder[spinIndex];

  if (!currentWinner) {
    return <div className="viewer-screen" />;
  }

  const isExceptionSpin =
    (serverState.last_selection_reasons?.[currentWinner] ?? "") === EXCEPTION_REASON;

  let currentParticipants = (isExceptionSpin ? exceptionParticipants : normalParticipants).filter(
    (name) => !completed.includes(name)
  );

  if (!currentParticipants.includes(currentWinner)) {
    currentParticipants = [...currentParticipants, currentWinner];
  }

  const winnerIdx = currentParticipants.indexOf(currentWinner);

  return (
    <div className="viewer-screen viewer-center">
      <p className="roulette-status">
        {isExceptionSpin ? "前回参加者から補充抽選中..." : "ルーレット抽選中..."}
      </p>
      <CanvasRoulette
        key={`${serverState.round_id}-${spinIndex}-${isExceptionSpin ? "exception" : "normal"}`}
        participants={currentParticipants}
        winnerIndex={winnerIdx}
        onFinish={async () => {
          if (spinIndex + 1 < spinOrder.length) {
            setSpinIndex((prev) => prev + 1);
            return;
          }

          setUiStatus("idle");

          if (serverState.round_id && completedRoundIdRef.current !== serverState.round_id) {
            completedRoundIdRef.current = serverState.round_id;
            await notifyPresentationComplete(serverState.round_id);
          }
        }}
      />
    </div>
  );
};
