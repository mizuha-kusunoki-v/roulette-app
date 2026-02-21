import { useEffect, useRef, useState } from "react";
import { RouletteState } from "../types";
import { CanvasRoulette } from "./CanvasRoulette";
import "./roulette.css";

const EXCEPTION_REASON = "exception_prev_round";

export const ViewerPage = () => {
  const [spinOrder, setSpinOrder] = useState<string[]>([]);
  const [normalParticipants, setNormalParticipants] = useState<string[]>([]);
  const [exceptionParticipants, setExceptionParticipants] = useState<string[]>([]);
  const [serverState, setServerState] = useState<RouletteState | null>(null);
  const [uiStatus, setUiStatus] = useState<"idle" | "running" | "done">("idle");
  const [spinIndex, setSpinIndex] = useState(0);

  const lastRoundIdRef = useRef<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:8000/ws");

    ws.onmessage = (e) => {
      const incoming = JSON.parse(e.data) as RouletteState;
      setServerState(incoming);
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    if (!serverState?.round_id || !serverState.result) return;
    if (serverState.round_id === lastRoundIdRef.current) return;

    lastRoundIdRef.current = serverState.round_id;

    const rawOrder = [...serverState.result.teamA, ...serverState.result.teamB];
    const reasons = serverState.last_selection_reasons ?? {};

    const normalWinners = rawOrder.filter((p) => reasons[p] !== EXCEPTION_REASON);
    const exceptionWinners = rawOrder.filter((p) => reasons[p] === EXCEPTION_REASON);
    setSpinOrder([...normalWinners, ...exceptionWinners]);

    const normalPool = serverState.participants.filter(
      (p) => !serverState.prev_players.includes(p) || serverState.forced_players.includes(p)
    );
    const exceptionPool = serverState.participants.filter(
      (p) => serverState.prev_players.includes(p) && !serverState.forced_players.includes(p)
    );

    setNormalParticipants(normalPool);
    setExceptionParticipants(exceptionPool);

    setSpinIndex(0);
    setUiStatus("running");
  }, [serverState]);

  if (!serverState) return <p>接続中...</p>;

  if (uiStatus === "running" && spinIndex < spinOrder.length) {
    const completed = spinOrder.slice(0, spinIndex);
    const currentWinner = spinOrder[spinIndex];
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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <p>{isExceptionSpin ? "例外候補から抽選中..." : "通常候補から抽選中..."}</p>
        <CanvasRoulette
          key={`${spinIndex}-${isExceptionSpin ? "exception" : "normal"}`}
          participants={currentParticipants}
          winnerIndex={winnerIdx}
          onFinish={() => {
            if (spinIndex + 1 < spinOrder.length) {
              setSpinIndex((prev) => prev + 1);
            } else {
              setUiStatus("done");
            }
          }}
        />
      </div>
    );
  }

  if (uiStatus === "done" && serverState.result) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <div className="result-panel">
          <h1 className="result-title">抽選結果</h1>
          <p className="result-team team-a">チーム A: {serverState.result.teamA.join(" / ")}</p>
          <p className="result-team team-b">チーム B: {serverState.result.teamB.join(" / ")}</p>
        </div>
      </div>
    );
  }

  return <p>次の抽選を待機中...</p>;
};
