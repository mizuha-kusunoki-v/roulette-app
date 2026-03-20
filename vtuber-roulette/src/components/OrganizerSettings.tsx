import { useEffect, useState } from "react";
import { updateOrganizerConfig } from "../api/client";
import { OrganizerMode } from "../types";

interface Props {
  organizerMode: OrganizerMode;
  organizers: string[];
  disabled: boolean;
  onUpdated: () => void;
}

export const OrganizerSettings = ({
  organizerMode,
  organizers,
  disabled,
  onUpdated,
}: Props) => {
  const organizer1 = organizers[0] ?? "";
  const organizer2 = organizers[1] ?? "";

  const [mode, setMode] = useState<OrganizerMode>(organizerMode);
  const [host1, setHost1] = useState(organizer1);
  const [host2, setHost2] = useState(organizer2);

  useEffect(() => {
    setMode(organizerMode);
  }, [organizerMode]);

  useEffect(() => {
    setHost1(organizer1);
  }, [organizer1]);

  useEffect(() => {
    setHost2(organizer2);
  }, [organizer2]);

  const save = async () => {
    const names = mode === "double" ? [host1, host2] : [host1];
    await updateOrganizerConfig(mode, names);
    await onUpdated();
  };

  return (
    <div>
      <h2>主催設定</h2>
      <label>
        <input
          type="radio"
          name="organizerMode"
          checked={mode === "single"}
          onChange={() => setMode("single")}
          disabled={disabled}
        />
        主催1人
      </label>
      {" "}
      <label>
        <input
          type="radio"
          name="organizerMode"
          checked={mode === "double"}
          onChange={() => setMode("double")}
          disabled={disabled}
        />
        主催2人
      </label>

      <div>
        <input
          value={host1}
          onChange={(e) => setHost1(e.target.value)}
          placeholder="主催1の名前"
          disabled={disabled}
        />
      </div>

      {mode === "double" && (
        <div>
          <input
            value={host2}
            onChange={(e) => setHost2(e.target.value)}
            placeholder="主催2の名前"
            disabled={disabled}
          />
        </div>
      )}

      <button onClick={save} disabled={disabled}>
        主催設定を保存
      </button>
    </div>
  );
};
