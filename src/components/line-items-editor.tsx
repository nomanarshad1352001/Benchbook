"use client";

import { Plus, Trash2 } from "lucide-react";
import type { LineItem } from "@/lib/model";
import { TAX_RATE } from "@/lib/constants";
import { cn, money } from "@/lib/utils";

const UNITS = ["hrs", "ea", "lot", "ft", "sq ft", "gal", "tubes", "day", "job"];

export default function LineItemsEditor({
  items,
  onChange,
  readOnly = false,
}: {
  items: LineItem[];
  onChange?: (items: LineItem[]) => void;
  readOnly?: boolean;
}) {
  const set = (id: number, patch: Partial<LineItem>) =>
    onChange?.(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const remove = (id: number) => onChange?.(items.filter((i) => i.id !== id));
  const add = (kind: "labour" | "material") =>
    onChange?.([
      ...items,
      {
        id: items.length ? Math.max(...items.map((i) => i.id)) + 1 : 1,
        description: "",
        kind,
        qty: kind === "labour" ? 2 : 1,
        unit: kind === "labour" ? "hrs" : "ea",
        rate: kind === "labour" ? 95 : 50,
      },
    ]);

  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);
  const hst = subtotal * TAX_RATE;

  const input =
    "w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm transition hover:border-line focus:border-ink focus:bg-white";

  return (
    <div>
      {/* header */}
      <div className="hidden grid-cols-[1fr_92px_64px_76px_92px_84px_32px] gap-1.5 px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-soft md:grid">
        <span>Description</span><span>Type</span><span>Qty</span><span>Unit</span><span>Rate</span><span className="text-right">Amount</span><span />
      </div>

      <div className="space-y-2">
        {items.map((it) => (
          <div
            key={it.id}
            className="grid grid-cols-2 gap-1.5 rounded-xl bg-canvas/60 p-2 md:grid-cols-[1fr_92px_64px_76px_92px_84px_32px] md:items-center md:bg-transparent md:p-0.5"
          >
            <input
              className={cn(input, "col-span-2 md:col-span-1")}
              placeholder={it.kind === "labour" ? "Describe the work…" : "Material or product…"}
              value={it.description}
              readOnly={readOnly}
              onChange={(e) => set(it.id, { description: e.target.value })}
            />
            <select
              className={input}
              value={it.kind}
              disabled={readOnly}
              onChange={(e) => set(it.id, { kind: e.target.value as LineItem["kind"] })}
            >
              <option value="labour">Labour</option>
              <option value="material">Material</option>
            </select>
            <input
              className={cn(input, "tnum")}
              type="number"
              min={0}
              step="0.5"
              value={it.qty}
              readOnly={readOnly}
              onChange={(e) => set(it.id, { qty: Number(e.target.value) })}
            />
            <select
              className={input}
              value={it.unit}
              disabled={readOnly}
              onChange={(e) => set(it.id, { unit: e.target.value })}
            >
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
            <input
              className={cn(input, "tnum")}
              type="number"
              min={0}
              step="0.01"
              value={it.rate}
              readOnly={readOnly}
              onChange={(e) => set(it.id, { rate: Number(e.target.value) })}
            />
            <span className="px-2 text-right text-sm font-bold tnum">{money(it.qty * it.rate)}</span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => remove(it.id)}
                className="grid size-7 place-items-center justify-self-end rounded-lg text-ink-soft/60 transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => add("labour")}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-line px-3.5 py-2 text-xs font-semibold text-ink-soft transition hover:border-blue-400 hover:text-blue-600"
          >
            <Plus className="size-3.5" /> Labour line
          </button>
          <button
            type="button"
            onClick={() => add("material")}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-line px-3.5 py-2 text-xs font-semibold text-ink-soft transition hover:border-amber-400 hover:text-amber-700"
          >
            <Plus className="size-3.5" /> Material line
          </button>
        </div>
      )}

      {/* totals */}
      <div className="mt-4 flex justify-end">
        <div className="w-full max-w-xs space-y-1.5 rounded-2xl bg-canvas p-4 sm:max-w-[300px]">
          <div className="flex justify-between text-sm text-ink-soft">
            <span>Subtotal</span><span className="font-semibold text-ink tnum">{money(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-ink-soft">
            <span>HST (13%)</span><span className="font-semibold text-ink tnum">{money(hst)}</span>
          </div>
          <div className="flex justify-between border-t border-line pt-2 font-display text-base font-bold">
            <span>Total</span><span className="tnum">{money(subtotal + hst)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
