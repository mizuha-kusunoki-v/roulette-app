import { useEffect, useState } from "react";
import { fetchRestrictionState, resetRestrictionState } from "../api/restrictionClient";
import { RestrictionState } from "../types";
import { RestrictionController } from "./RestrictionController";
import { RestrictionItemManager } from "./RestrictionItemManager";
import "./restriction-admin.css";

const RestrictionAdminApp = () => {
  const [state, setState] = useState<RestrictionState | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const reload = async () => {
    const next = await fetchRestrictionState();
    setState(next);
  };

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:8000/restriction/ws");
    ws.onmessage = (e) => {
      const incoming = JSON.parse(e.data) as RestrictionState;
      setState(incoming);
    };
    return () => ws.close();
  }, []);

  const handleReset = async () => {
    if (state?.phase === "spinning") return;
    try {
      setResetError(null);
      await resetRestrictionState();
      await reload();
    } catch (e) {
      setResetError(e instanceof Error ? e.message : String(e));
    }
  };

  if (!state) return <p className="ra-loading">Loading...</p>;

  const isLocked = state.phase === "spinning";

  return (
    <div className="ra-root">
      <header className="ra-header">
        <h1 className="ra-title">縛りルーレット Admin</h1>
        <div className="ra-header-actions">
          <a className="ra-link" href="/" target="_blank" rel="noopener noreferrer">
            チーム決定 Admin →
          </a>
        </div>
      </header>

      <div className="ra-body">
        {/* 左: アイテム管理 */}
        <div className="ra-col ra-col--left">
          <RestrictionItemManager
            items={state.items}
            disabled={isLocked}
            onUpdated={reload}
          />
        </div>

        {/* 右: ルーレット操作 */}
        <div className="ra-col ra-col--right">
          <RestrictionController
            phase={state.phase}
            result={state.result}
            target={state.target}
            excludeRecentCount={state.exclude_recent_count}
            disabled={isLocked}
            onUpdated={reload}
          />

          {/* 履歴 */}
          {state.history.length > 0 && (
            <section className="ra-history">
              <h3 className="ra-history-title">選択履歴</h3>
              <ol className="ra-history-list">
                {[...state.history].reverse().map((id, idx) => {
                  const item = state.items.find((i) => i.id === id);
                  return (
                    <li key={`${id}-${idx}`} className="ra-history-item">
                      {item ? item.name : `(削除済み: ${id.slice(0, 8)})`}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {/* リセット */}
          <div className="ra-reset">
            {resetError && <p className="ra-error">{resetError}</p>}
            <button
              className="ra-reset-btn"
              onClick={handleReset}
              disabled={isLocked}
            >
              結果リセット
            </button>
            <p className="ra-reset-note">※ アイテムリストと履歴は保持されます</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestrictionAdminApp;
