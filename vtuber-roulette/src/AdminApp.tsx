import { useEffect, useState } from "react";
import { fetchState } from "./api/client";
import { RouletteState, RouletteResult } from "./types";
import { ParticipantManager } from "./components/ParticipantManager";
import { RouletteController } from "./components/RouletteController";
import { RouletteDisplay } from "./components/RouletteDisplay";
import { MatchInfo } from "./components/MatchInfo";

const AdminApp = () => {
  const [state, setState] = useState<RouletteState | null>(null);
  const [result, setResult] = useState<RouletteResult | null>(null);

  const reload = async () => {
    const s = await fetchState();
    setState(s);
    setResult(s.result);
  };

  useEffect(() => {
    reload();
  }, []);

  if (!state) return <p>Loading...</p>;

  return (
    <div>
      <h1>Roulette Admin</h1>

      <ParticipantManager
        participants={state.participants}
        forcedPlayers={state.forced_players}
        autoForcedPlayers={state.auto_forced_players}
        excludedPlayers={state.excluded_players}
        participationCounts={state.participation_counts}
        onUpdated={reload}
      />

      <RouletteController onResult={setResult} onUpdated={reload} />

      <RouletteDisplay result={result} />
      <MatchInfo state={state} />
    </div>
  );
};

export default AdminApp;
