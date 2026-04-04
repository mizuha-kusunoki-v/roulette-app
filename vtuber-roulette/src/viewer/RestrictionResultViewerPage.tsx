import { useEffect, useState } from "react";
import { RestrictionState } from "../types";
import "./roulette.css";
import "./restriction-viewer.css";

/**
 * 縛りルーレット 結果表示専用 Viewer
 * OBS Browser Source: /viewer/restriction/result
 * result フェーズ中のみ縛り名・説明・対象を表示する。
 */
export const RestrictionResultViewerPage = () => {
  const [serverState, setServerState] = useState<RestrictionState | null>(null);

  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:8000/restriction/ws");
    ws.onmessage = (e) => {
      const incoming = JSON.parse(e.data) as RestrictionState;
      setServerState(incoming);
    };
    return () => ws.close();
  }, []);

  if (!serverState || serverState.phase !== "result" || !serverState.result) {
    return <div className="viewer-screen" />;
  }

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
};
