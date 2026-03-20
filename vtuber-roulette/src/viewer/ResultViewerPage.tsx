import { useEffect, useState } from "react";
import { RouletteState } from "../types";
import { getDisplayTeams } from "../utils/resultDisplay";
import "./roulette.css";

export const ResultViewerPage = () => {
  const [serverState, setServerState] = useState<RouletteState | null>(null);

  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:8000/ws");

    ws.onmessage = (e) => {
      const incoming = JSON.parse(e.data) as RouletteState;
      setServerState(incoming);
    };

    return () => ws.close();
  }, []);

  if (!serverState) {
    return <p>Loading...</p>;
  }

  if (serverState.phase === "spinning") {
    return (
      <div className="viewer-screen viewer-center">
        <div className="status-panel">抽選中</div>
      </div>
    );
  }

  if (!serverState.result) {
    return (
      <div className="viewer-screen viewer-center">
        <div className="status-panel">抽選結果待機中</div>
      </div>
    );
  }

  const teams = getDisplayTeams(
    serverState.result,
    serverState.organizers,
    serverState.organizer_mode,
    serverState.selected_organizer_index,
  );

  return (
    <div className="viewer-screen viewer-center">
      <div className="result-panel">
        <h1 className="result-title">抽選結果</h1>
        {teams.map((team, index) => (
          <p
            key={team.label}
            className={`result-team ${index === 0 ? "team-a" : "team-b"}`}
          >
            {team.label}: {team.players.join(" / ")}
          </p>
        ))}
      </div>
    </div>
  );
};
