import { useEffect, useRef, useState } from "react";
import { RouletteState } from "../types";
import { CanvasRoulette } from "./CanvasRoulette";
import "./roulette.css"

export const ViewerPage = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOrder, setSelectedOrder] =
    useState<string[]>([]);

  const [wheelParticipants, setWheelParticipants] =
    useState<string[]>([]);

  const [serverState, setServerState] =
    useState<RouletteState | null>(null);

  const [uiStatus, setUiStatus] =
    useState<"idle" | "running" | "done">("idle");

  const [spinIndex, setSpinIndex] = useState(0);

  const lastRoundIdRef = useRef<string | null>(null);

  useEffect(() => {
    console.log("[Viewer] opening ws");
    const ws = new WebSocket("ws://127.0.0.1:8000/ws");

    ws.onopen = () => {
        console.log("[Viewer WS] connected");
    };

    ws.onmessage = (e) => {
        const incoming = JSON.parse(e.data);
        console.log("[Viewer WS] message", incoming);
        setServerState(incoming);
    };

    return () => ws.close();
    }, []);

  useEffect(() => {
    // round_id が無い = まだ抽選が始まっていない
    if (!serverState?.round_id) {
        console.log("[Viewer] round_id is null, waiting...");
        return;
    }

    // すでに処理済みの round_id なら何もしない
    if (serverState.round_id === lastRoundIdRef.current) return;
    lastRoundIdRef.current = serverState.round_id;

    console.log("[Viewer] new round detected:", serverState.round_id);
    if(!serverState.result) return;
    // ===== ① 確定順（3人 or 4人）=====
    const order = [
        ...serverState.result.teamA,
        ...serverState.result.teamB,
    ];
    setSelectedOrder(order);

    // ===== ② 抽選対象（前回参加者を除外）=====
    const candidates = serverState.participants.filter(
        (p) => !serverState.prev_players.includes(p)
    );

    // ID → 表示名変換
    const ids = serverState.last_players ?? [];
    const toName = (id: string) => {
        const i = ids.indexOf(id);
        return i >= 0 ? order[i] : id;
    };

    const displayCandidates = candidates.map(toName);
    setWheelParticipants(displayCandidates);

    // ===== ③ 回転開始 =====
    setSpinIndex(0);
    setUiStatus("running");
    console.log("set running")
    }, [serverState]);

  if (!serverState) return <p>接続中…</p>;
  if (uiStatus === "running" && spinIndex < selectedOrder.length) {

    // ✅ ① 今回の抽選対象（Canvas に渡す配列）
    const currentParticipants = wheelParticipants.filter(
        name =>
        !selectedOrder.slice(0, spinIndex).includes(name)
    );

    // ✅ ② 「その配列 기준」で winnerIndex を計算
    const winnerIdx =
        currentParticipants.indexOf(selectedOrder[spinIndex]);
  console.log("[Viewer render]", {
    spinIndex,
    selectedOrder,
    wheelParticipants,
    currentWinner: selectedOrder[spinIndex],
    });
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
      }}
    >
      {uiStatus === "running" && currentIndex < selectedOrder.length && (
        
        <CanvasRoulette
            key={spinIndex}
            participants={currentParticipants}
            winnerIndex={winnerIdx}
            onFinish={() => {
                console.log("[Viewer] onFinish called", spinIndex);

                if (spinIndex + 1 < selectedOrder.length) {
                setSpinIndex((prev) => prev + 1);
                } else {
                setUiStatus("done");
                }
            }}
            />
      )}
    </div>
  );
} else if(uiStatus === "done") {
    return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
      }}
    >
    {uiStatus === "done" && serverState.result && (
        <div className="result-panel">
            <h1 className="result-title">🎉 抽選結果</h1>

            <p className="result-team team-a">
            {serverState.result.teamA.length === 1
            ? `チームA：みずは / ${serverState.result.teamA[0]}`
            : `チームA：${serverState.result.teamA.join(" / ")}`}
            </p>
            <p className="result-team team-b">
            チームB：{serverState.result.teamB.join(" / ")}
            </p>

            <div className="result-sub">
            <h3>前回参加者</h3>
            <p>{serverState.prev_players.join(", ") || "なし"}</p>
            </div>

            <div className="result-sub">
            <h3>次回確定枠</h3>
            <p>
                {Object.entries(serverState.miss_counts)
                .filter(([_, c]) => c >= 3)
                .map(([name]) => name)
                .join(", ") || "なし"}
            </p>
            </div>
        </div>
        )}
    </div>
    );
}
};