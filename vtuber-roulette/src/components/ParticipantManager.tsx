import { useState } from "react";
import { updateExcludedPlayers, updateForcedPlayers, updateParticipants } from "../api/client";

interface Props {
  participants: string[];
  forcedPlayers: string[];
  autoForcedPlayers: string[];
  excludedPlayers: string[];
  participationCounts: Record<string, number>;
  onUpdated: () => void;
}

export const ParticipantManager = ({
  participants,
  forcedPlayers,
  autoForcedPlayers,
  excludedPlayers,
  participationCounts,
  onUpdated,
}: Props) => {
  const [name, setName] = useState("");

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed || participants.includes(trimmed)) return;
    await updateParticipants([...participants, trimmed]);
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

  const toggleExcluded = async (target: string) => {
    const exists = excludedPlayers.includes(target);
    if (exists) {
      await updateExcludedPlayers(excludedPlayers.filter((p) => p !== target));
      onUpdated();
      return;
    }

    await updateExcludedPlayers([...excludedPlayers, target]);
    onUpdated();
  };

  return (
    <div>
      <h2>参加者管理</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="参加者名を入力"
      />
      <button onClick={add}>追加</button>

      <ul>
        {participants.map((player) => {
          const checkedForced = forcedPlayers.includes(player);
          const disabledForced = !checkedForced && forcedPlayers.length >= 2;
          const checkedExcluded = excludedPlayers.includes(player);

          return (
            <li key={player}>
              <input
                type="checkbox"
                checked={checkedForced}
                disabled={disabledForced}
                onChange={() => toggleForced(player)}
              />{" "}
              強制
              {" "}
              <input
                type="checkbox"
                checked={checkedExcluded}
                onChange={() => toggleExcluded(player)}
              />{" "}
              除外
              {" "}
              {player} (参加回数: {participationCounts[player] ?? 0}){" "}
              {autoForcedPlayers.includes(player) && <span>[自動強制対象]</span>}{" "}
              {checkedForced && <span>[手動強制]</span>}{" "}
              {checkedExcluded && <span>[除外中]</span>}{" "}
              <button onClick={() => remove(player)}>削除</button>
            </li>
          );
        })}
      </ul>
      <p>手動強制は最大2人まで選択できます。</p>
    </div>
  );
};
