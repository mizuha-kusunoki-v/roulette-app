import { useState } from "react";
import { updateParticipants } from "../api/client";

interface Props {
  participants: string[];
  onUpdated: () => void;
}

export const ParticipantManager = ({ participants, onUpdated }: Props) => {
  const [name, setName] = useState("");

  const add = async () => {
    if (!name || participants.includes(name)) return;
    await updateParticipants([...participants, name]);
    setName("");
    onUpdated();
  };

  const remove = async (target: string) => {
    await updateParticipants(participants.filter(p => p !== target));
    onUpdated();
  };

  return (
    <div>
      <h2>参加者管理</h2>
      <input value={name} onChange={e => setName(e.target.value)} />
      <button onClick={add}>追加</button>

      <ul>
        {participants.map(p => (
          <li key={p}>
            {p} <button onClick={() => remove(p)}>削除</button>
          </li>
        ))}
      </ul>
    </div>
  );
};