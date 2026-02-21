import { useState } from "react";
import { updateForcedPlayers, updateParticipants } from "../api/client";

interface Props {
  participants: string[];
  forcedPlayers: string[];
  autoForcedPlayers: string[];
  participationCounts: Record<string, number>;
  onUpdated: () => void;
}

export const ParticipantManager = ({
  participants,
  forcedPlayers,
  autoForcedPlayers,
  participationCounts,
  onUpdated,
}: Props) => {
  const [name, setName] = useState("");

  const add = async () => {
    if (!name || participants.includes(name)) return;
    await updateParticipants([...participants, name]);
    setName("");
    onUpdated();
  };

  const remove = async (target: string) => {
    await updateParticipants(participants.filter((p) => p !== target));
    onUpdated();
  };

  const toggleForced = async (target: string) => {
    const exists = forcedPlayers.includes(target);
    if (exists) {
      await updateForcedPlayers(forcedPlayers.filter((p) => p !== target));
      onUpdated();
      return;
    }

    if (forcedPlayers.length >= 2) return;

    await updateForcedPlayers([...forcedPlayers, target]);
    onUpdated();
  };

  return (
    <div>
      <h2>参加者管理</h2>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={add}>追加</button>

      <ul>
        {participants.map((p) => {
          const checked = forcedPlayers.includes(p);
          const disabled = !checked && forcedPlayers.length >= 2;

          return (
            <li key={p}>
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => toggleForced(p)}
              />{" "}
              {p} (参加回数: {participationCounts[p] ?? 0}){" "}
              {autoForcedPlayers.includes(p) && <span>[自動強制対象]</span>}{" "}
              {checked && <span>[手動強制]</span>}{" "}
              <button onClick={() => remove(p)}>削除</button>
            </li>
          );
        })}
      </ul>
      <p>手動強制は最大2人まで選択できます。</p>
    </div>
  );
};
