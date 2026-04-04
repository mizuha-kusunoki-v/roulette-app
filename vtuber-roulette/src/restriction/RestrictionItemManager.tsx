import { useRef, useState } from "react";
import { updateRestrictionItems } from "../api/restrictionClient";
import { RestrictionItem } from "../types";

interface Props {
  items: RestrictionItem[];
  disabled: boolean;
  onUpdated: () => void;
}

const WEIGHT_OPTIONS = [1, 2, 3, 4, 5] as const;

/** 新規アイテム用のデフォルト値 */
const emptyForm = () => ({ name: "", description: "", weight: 1 });

export const RestrictionItemManager = ({ items, disabled, onUpdated }: Props) => {
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const save = async (nextItems: RestrictionItem[]) => {
    try {
      await updateRestrictionItems(nextItems);
      onUpdated();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /** アイテム追加 */
  const handleAdd = async () => {
    const name = form.name.trim();
    if (!name) return;
    if (items.some((i) => i.name === name)) {
      setError("同じ名前のアイテムが既に存在します。");
      return;
    }
    const newItem: RestrictionItem = {
      id: crypto.randomUUID(),
      name,
      description: form.description.trim(),
      enabled: true,
      weight: form.weight,
      use_count: 0,
    };
    await save([...items, newItem]);
    setForm(emptyForm());
  };

  /** 有効/無効 トグル */
  const handleToggle = async (id: string) => {
    await save(items.map((i) => (i.id === id ? { ...i, enabled: !i.enabled } : i)));
  };

  /** 削除 */
  const handleDelete = async (id: string) => {
    await save(items.filter((i) => i.id !== id));
  };

  /** 編集開始 */
  const startEdit = (item: RestrictionItem) => {
    setEditingId(item.id);
    setEditForm({ name: item.name, description: item.description, weight: item.weight });
  };

  /** 編集確定 */
  const handleEditSave = async (id: string) => {
    const name = editForm.name.trim();
    if (!name) return;
    if (items.some((i) => i.id !== id && i.name === name)) {
      setError("同じ名前のアイテムが既に存在します。");
      return;
    }
    await save(
      items.map((i) =>
        i.id === id
          ? { ...i, name, description: editForm.description.trim(), weight: editForm.weight }
          : i
      )
    );
    setEditingId(null);
  };

  /** CSV エクスポート */
  const handleExport = () => {
    const rows = [
      ["name", "description", "weight", "enabled"],
      ...items.map((i) => [i.name, i.description, String(i.weight), String(i.enabled)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "restriction_items.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  /** CSV インポート */
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = (ev.target?.result as string).replace(/^\uFEFF/, "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const [header, ...dataRows] = lines;
      if (!header) return;

      const cols = header.split(",").map((c) => c.replace(/^"|"$/g, "").trim().toLowerCase());
      const nameIdx = cols.indexOf("name");
      const descIdx = cols.indexOf("description");
      const weightIdx = cols.indexOf("weight");

      if (nameIdx === -1) {
        setError("CSV に name 列が見つかりません。");
        return;
      }

      const parseRow = (line: string): string[] => {
        const result: string[] = [];
        let cur = "";
        let inQuote = false;
        for (const ch of line) {
          if (ch === '"') { inQuote = !inQuote; continue; }
          if (ch === "," && !inQuote) { result.push(cur); cur = ""; continue; }
          cur += ch;
        }
        result.push(cur);
        return result;
      };

      const imported: RestrictionItem[] = dataRows
        .map((row) => parseRow(row))
        .filter((cols) => cols[nameIdx]?.trim())
        .map((cols) => ({
          id: crypto.randomUUID(),
          name: cols[nameIdx].trim(),
          description: descIdx !== -1 ? cols[descIdx]?.trim() ?? "" : "",
          weight: weightIdx !== -1 ? Math.min(5, Math.max(1, Number(cols[weightIdx]) || 1)) : 1,
          enabled: true,
          use_count: 0,
        }));

      // 既存との重複を除外して末尾に追加
      const existingNames = new Set(items.map((i) => i.name));
      const fresh = imported.filter((i) => !existingNames.has(i.name));
      await save([...items, ...fresh]);
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  return (
    <section className="ri-section">
      <h2 className="ri-section-title">縛りアイテム管理</h2>

      {error && <p className="ri-error">{error}</p>}

      {/* アイテムリスト */}
      <ul className="ri-list">
        {items.length === 0 && (
          <li className="ri-empty">アイテムがありません。下のフォームから追加してください。</li>
        )}
        {items.map((item) =>
          editingId === item.id ? (
            /* 編集モード行 */
            <li key={item.id} className="ri-item ri-item--editing">
              <input
                className="ri-input"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="縛り名"
              />
              <input
                className="ri-input ri-input--desc"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="説明"
              />
              <select
                className="ri-select"
                value={editForm.weight}
                onChange={(e) => setEditForm({ ...editForm, weight: Number(e.target.value) })}
              >
                {WEIGHT_OPTIONS.map((w) => (
                  <option key={w} value={w}>重み {w}</option>
                ))}
              </select>
              <button className="ri-btn ri-btn--primary" onClick={() => handleEditSave(item.id)}>
                保存
              </button>
              <button className="ri-btn" onClick={() => setEditingId(null)}>
                キャンセル
              </button>
            </li>
          ) : (
            /* 通常表示行 */
            <li key={item.id} className={`ri-item ${!item.enabled ? "ri-item--disabled" : ""}`}>
              <label className="ri-toggle">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  disabled={disabled}
                  onChange={() => handleToggle(item.id)}
                />
              </label>
              <span className="ri-name">{item.name}</span>
              {item.description && (
                <span className="ri-desc">{item.description}</span>
              )}
              <span className="ri-weight">重み {item.weight}</span>
              <span className="ri-count">使用 {item.use_count} 回</span>
              <button
                className="ri-btn ri-btn--sm"
                disabled={disabled}
                onClick={() => startEdit(item)}
              >
                編集
              </button>
              <button
                className="ri-btn ri-btn--sm ri-btn--danger"
                disabled={disabled}
                onClick={() => handleDelete(item.id)}
              >
                削除
              </button>
            </li>
          )
        )}
      </ul>

      {/* 追加フォーム */}
      <div className="ri-add-form">
        <input
          className="ri-input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="縛り名 *"
          disabled={disabled}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <input
          className="ri-input ri-input--desc"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="説明（任意）"
          disabled={disabled}
        />
        <select
          className="ri-select"
          value={form.weight}
          onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
          disabled={disabled}
        >
          {WEIGHT_OPTIONS.map((w) => (
            <option key={w} value={w}>重み {w}</option>
          ))}
        </select>
        <button className="ri-btn ri-btn--primary" disabled={disabled || !form.name.trim()} onClick={handleAdd}>
          追加
        </button>
      </div>

      {/* CSV ボタン */}
      <div className="ri-csv-row">
        <button className="ri-btn" disabled={disabled || items.length === 0} onClick={handleExport}>
          CSV エクスポート
        </button>
        <button className="ri-btn" disabled={disabled} onClick={() => fileInputRef.current?.click()}>
          CSV インポート
        </button>
        <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleImport} />
      </div>
    </section>
  );
};
