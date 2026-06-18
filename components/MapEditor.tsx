"use client";
import { ArrowDown, ArrowLeft, ArrowUp, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import SimilarNearby from "@/components/SimilarNearby";
import { Button, PageScaffold } from "@/components/ui";
import { fmtDist } from "@/lib/geo";
import { getMap, saveMap } from "@/lib/data";
import {
  clearMapDraft,
  loadMapDraft,
  saveMapDraft,
} from "@/lib/storage";
import { rankResults } from "@/lib/rank";
import type {
  GeocodeResult,
  RankedResult,
  StoredMap,
  StoredMapItem,
  YonderMode,
} from "@/lib/types";

export default function MapEditor({ editId }: { editId?: string } = {}) {
  const router = useRouter();
  const editing = !!editId;
  const { fix } = useGeolocation(true);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<YonderMode>("collection");
  const [items, setItems] = useState<StoredMapItem[]>([]);
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [visibility, setVisibility] = useState<StoredMap["visibility"]>();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<RankedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);
  // Position via ref so a moving fix doesn't re-fire search every GPS tick.
  const fixRef = useRef(fix);
  fixRef.current = fix;

  // Editing an existing map: load it. Otherwise (new) restore any draft so
  // navigating away never loses a map you were setting up.
  useEffect(() => {
    if (editing) {
      let c = false;
      void getMap(editId).then((m) => {
        if (c || !m) return;
        setName(m.name);
        setMode(m.mode);
        setItems(m.items);
        setCreatedAt(m.createdAt);
        setVisibility(m.visibility);
      });
      return () => {
        c = true;
      };
    }
    const d = loadMapDraft();
    if (d) {
      setName(d.name);
      setMode(d.mode);
      setItems(d.items);
    }
  }, [editing, editId]);

  useEffect(() => {
    if (editing) return; // drafts are for new maps only
    if (items.length === 0 && !name.trim()) {
      clearMapDraft();
      return;
    }
    saveMapDraft({ name, mode, items });
  }, [editing, name, mode, items]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    const myReq = ++reqId.current;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(term)}`);
        if (myReq !== reqId.current) return;
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = (await res.json()) as GeocodeResult[];
        setResults(rankResults(data, fixRef.current));
      } catch {
        if (myReq === reqId.current) setResults([]);
      } finally {
        if (myReq === reqId.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [q]);

  const add = (r: { name: string; label: string; lat: number; lon: number }) => {
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: r.name,
        label: r.label,
        lat: r.lat,
        lon: r.lon,
        visited: false,
      },
    ]);
    setQ("");
    setResults([]);
  };

  const remove = (id: string) =>
    setItems((prev) => prev.filter((i) => i.id !== id));

  const move = (id: string, dir: -1 | 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const save = async () => {
    const finalName = name.trim() || items[0]?.name || "Untitled map";
    const now = Date.now();
    const map: StoredMap = {
      id: editId ?? crypto.randomUUID(),
      name: finalName,
      mode: items.length === 1 ? "single" : mode,
      items,
      createdAt: editing ? (createdAt ?? now) : now,
      updatedAt: now,
      visibility,
    };
    await saveMap(map);
    if (!editing) clearMapDraft();
    router.push(`/maps/${map.id}`);
  };

  const showOrderControls = mode === "ordered";

  return (
    <PageScaffold>
      <header className="flex items-center gap-3">
        <Link
          href="/maps"
          aria-label="Back"
          className="size-9 -ml-2 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
        </Link>
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
            {editing ? "Edit map" : "New map"}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={items[0]?.name ?? "Name this map"}
            className="font-display text-3xl tracking-tight bg-transparent outline-none placeholder:text-[var(--muted)]/70 leading-none"
          />
        </div>
      </header>

      {items.length >= 2 && (
        <div role="radiogroup" aria-label="List type" className="flex gap-2 text-sm">
          <ModeChip
            label="Wander between"
            sub="Collection, no order"
            active={mode === "collection"}
            onClick={() => setMode("collection")}
          />
          <ModeChip
            label="Step through"
            sub="Ordered, one by one"
            active={mode === "ordered"}
            onClick={() => setMode("ordered")}
          />
        </div>
      )}

      <ol className="flex flex-col">
        {items.length === 0 && (
          <li className="text-sm text-[var(--muted)] py-2">
            Add a place below. One picks a destination; two or more lets you
            wander between them.
          </li>
        )}
        {items.map((it, i) => (
          <li
            key={it.id}
            className="flex items-center gap-2 py-2 border-b border-[var(--border)]"
          >
            <div className="font-mono text-xs text-[var(--accent)] tabular-nums w-5 shrink-0">
              {showOrderControls ? `${i + 1}.` : "·"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-base truncate">{it.name}</div>
              {it.label && (
                <div className="text-xs text-[var(--muted)] truncate">
                  {it.label}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 text-[var(--muted)]">
              {showOrderControls && (
                <>
                  <button
                    type="button"
                    onClick={() => move(it.id, -1)}
                    disabled={i === 0}
                    className="size-8 flex items-center justify-center disabled:opacity-30 hover:text-[var(--foreground)]"
                    aria-label="Move up"
                  >
                    <ArrowUp className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(it.id, 1)}
                    disabled={i === items.length - 1}
                    className="size-8 flex items-center justify-center disabled:opacity-30 hover:text-[var(--foreground)]"
                    aria-label="Move down"
                  >
                    <ArrowDown className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => remove(it.id)}
                className="size-8 flex items-center justify-center hover:text-red-400"
                aria-label="Remove"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          </li>
        ))}
      </ol>

      <label className="flex flex-col gap-2 mt-1">
        <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
          Add a place
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a place…"
          className="w-full bg-transparent border-b border-[var(--border)] px-1 py-2 text-base outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/60"
          inputMode="search"
          enterKeyHint="search"
        />
      </label>

      <ul className="flex flex-col divide-y divide-[var(--border)] min-h-12">
        {loading && (
          <li className="text-sm text-[var(--muted)] py-2">Searching…</li>
        )}
        {results.map((r, i) => (
          <li key={`${r.lat},${r.lon},${i}`}>
            <button
              type="button"
              onClick={() => add({ name: r.name, label: r.label, lat: r.lat, lon: r.lon })}
              className="w-full text-left py-2 hover:text-[var(--accent)]"
            >
              {r.dist != null && (
                <div className="text-[11px] font-mono text-[var(--accent)] tabular-nums">
                  {fmtDist(r.dist)} away
                </div>
              )}
              <div className="font-display text-base truncate">{r.name}</div>
              <div className="text-xs text-[var(--muted)] truncate">{r.label}</div>
            </button>
          </li>
        ))}
      </ul>

      {items.length >= 1 && (
        <SimilarNearby
          items={items.map((it) => ({ lat: it.lat, lon: it.lon }))}
          fallback={fix ? { lat: fix.lat, lon: fix.lon } : null}
          existingNames={new Set(items.map((it) => it.name.toLowerCase()))}
          onAdd={(p) => add(p)}
        />
      )}

      <Button
        variant="primary"
        onClick={() => void save()}
        disabled={items.length === 0}
        className="mt-auto"
      >
        Save map
      </Button>
    </PageScaffold>
  );
}

function ModeChip({
  label,
  sub,
  active,
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex-1 rounded-2xl border px-3 py-2 text-left transition-colors ${
        active
          ? "border-[var(--accent)] bg-[var(--surface)]"
          : "border-[var(--border)] hover:border-[var(--muted)]"
      }`}
    >
      <div className={`text-sm font-medium ${active ? "text-[var(--accent)]" : "text-[var(--foreground)]"}`}>
        {label}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-[var(--muted)] mt-0.5">
        {sub}
      </div>
    </button>
  );
}
