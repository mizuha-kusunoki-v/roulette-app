import { useEffect, useState } from "react";
import { updateOrganizerConfig } from "../api/client";
import { OrganizerMode } from "../types";

interface Props {
  organizerMode: OrganizerMode;
  organizers: string[];
  selectedOrganizerIndex: number;
  disabled: boolean;
  onUpdated: () => void;
}

export const OrganizerSettings = ({
  organizerMode,
  organizers,
  selectedOrganizerIndex,
  disabled,
  onUpdated,
}: Props) => {
  const organizer1 = organizers[0] ?? "";
  const organizer2 = organizers[1] ?? "";

  const [mode, setMode] = useState<OrganizerMode>(organizerMode);
  const [host1, setHost1] = useState(organizer1);
  const [host2, setHost2] = useState(organizer2);
  const [selectedIndex, setSelectedIndex] = useState(selectedOrganizerIndex === 1 ? 1 : 0);

  useEffect(() => {
    setMode(organizerMode);
  }, [organizerMode]);

  useEffect(() => {
    setHost1(organizer1);
  }, [organizer1]);

  useEffect(() => {
    setHost2(organizer2);
  }, [organizer2]);

  useEffect(() => {
    setSelectedIndex(selectedOrganizerIndex === 1 ? 1 : 0);
  }, [selectedOrganizerIndex]);

  const hasTwoHosts = host1.trim() !== "" && host2.trim() !== "";
  const selectionDisabled = disabled || mode === "double" || !hasTwoHosts;

  const save = async () => {
    await updateOrganizerConfig(mode, [host1, host2], selectedIndex);
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
        {" "}
        <label>
          <input
            type="checkbox"
            checked={selectedIndex === 0}
            disabled={selectionDisabled}
            onChange={() => setSelectedIndex(0)}
          />
          1人主催で採用
        </label>
      </div>

      <div>
        <input
          value={host2}
          onChange={(e) => setHost2(e.target.value)}
          placeholder="主催2の名前"
          disabled={disabled}
        />
        {" "}
        <label>
          <input
            type="checkbox"
            checked={selectedIndex === 1}
            disabled={selectionDisabled}
            onChange={() => setSelectedIndex(1)}
          />
          1人主催で採用
        </label>
      </div>

      {!hasTwoHosts && mode === "single" && (
        <p>主催名が2人分入力されたときだけ、採用する主催を切り替えられます。</p>
      )}

      {mode === "double" && (
        <p>主催2人モードでは入力済みの2人をそのまま主催として使用します。</p>
      )}

      <button onClick={save} disabled={disabled}>
        主催設定を保存
      </button>
    </div>
  );
};
