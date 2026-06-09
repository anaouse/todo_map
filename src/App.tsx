import { useState, useRef, useCallback, useEffect } from "react";

const GRID = 32;
const MIN_SCALE = 0.3;
const MAX_SCALE = 2.5;
const API = "http://localhost:11134";

// ── Types ────────────────────────────────────────────────────────────────────

interface TodoItem {
  id: string;
  x: number;
  y: number;
  text: string;
  done: boolean;
}

interface CanvasMeta {
  id: string;
  name: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function snapWorld(w: number) {
  return Math.round(w / GRID) * GRID;
}
function toWorld(px: number, scale: number, off: number) {
  return (px - off) / scale;
}

let idCounter = Date.now();
function newId() {
  return `todo-${++idCounter}`;
}
function canvasId(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `canvas-${Date.now()}`
  );
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiListCanvases(): Promise<CanvasMeta[]> {
  const r = await fetch(`${API}/canvases`);
  return r.json();
}
async function apiCreateCanvas(id: string, name: string): Promise<void> {
  await fetch(`${API}/canvases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, name }),
  });
}
async function apiGetCanvas(id: string): Promise<{ items: TodoItem[] }> {
  const r = await fetch(`${API}/canvases/${id}`);
  return r.json();
}
async function apiSaveItems(id: string, items: TodoItem[]): Promise<void> {
  await fetch(`${API}/canvases/${id}/items`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(items),
  });
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  // Canvas list & current canvas
  const [canvases, setCanvases] = useState<CanvasMeta[]>([]);
  const [currentCanvas, setCurrentCanvas] = useState<CanvasMeta | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newCanvasName, setNewCanvasName] = useState("");
  const [creatingCanvas, setCreatingCanvas] = useState(false);

  // Todo state
  const [items, setItems] = useState<TodoItem[]>([]);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [dragging, setDragging] = useState<{
    id: string;
    startMouse: { x: number; y: number };
    startPos: { x: number; y: number };
  } | null>(null);
  const [multiDrag, setMultiDrag] = useState<{
    startMouse: { x: number; y: number };
    startPositions: Record<string, { x: number; y: number }>;
  } | null>(null);
  const [panning, setPanning] = useState<{
    startMouse: { x: number; y: number };
    startOffset: { x: number; y: number };
  } | null>(null);
  const [marquee, setMarquee] = useState<{
    startScreen: { x: number; y: number };
    endScreen: { x: number; y: number };
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newCanvasInputRef = useRef<HTMLInputElement | null>(null);

  // ── Persistence ─────────────────────────────────────────────────────────────

  // Load canvas list on mount
  useEffect(() => {
    apiListCanvases().then((list) => {
      setCanvases(list);
      if (list.length > 0) loadCanvas(list[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCanvas = useCallback(async (meta: CanvasMeta) => {
    setEditingId(null);
    setSelectedIds(new Set());
    const data = await apiGetCanvas(meta.id);
    setItems(data.items ?? []);
    setCurrentCanvas(meta);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setMenuOpen(false);
  }, []);

  // Debounced auto-save whenever items change
  useEffect(() => {
    if (!currentCanvas) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      apiSaveItems(currentCanvas.id, items);
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [items, currentCanvas]);

  const handleCreateCanvas = useCallback(async () => {
    const name = newCanvasName.trim();
    if (!name) return;
    const id = canvasId(name);
    await apiCreateCanvas(id, name);
    const meta = { id, name };
    setCanvases((prev) => [...prev, meta]);
    setNewCanvasName("");
    setCreatingCanvas(false);
    loadCanvas(meta);
  }, [newCanvasName, loadCanvas]);

  // Focus new-canvas input when it appears
  useEffect(() => {
    if (creatingCanvas) newCanvasInputRef.current?.focus();
  }, [creatingCanvas]);

  // ── Focus input ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (editingId && inputRefs.current[editingId]) {
      inputRefs.current[editingId]?.focus();
    }
  }, [editingId]);

  // ── Canvas interactions ──────────────────────────────────────────────────────

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = canvasRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * delta));
      setOffset((prev) => ({
        x: mx - (mx - prev.x) * (newScale / scale),
        y: my - (my - prev.y) * (newScale / scale),
      }));
      setScale(newScale);
    },
    [scale],
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest(".todo-node")) return;
      const rect = canvasRef.current!.getBoundingClientRect();
      const gx = snapWorld(toWorld(e.clientX - rect.left, scale, offset.x));
      const gy = snapWorld(toWorld(e.clientY - rect.top, scale, offset.y));
      const id = newId();
      setItems((prev) => [
        ...prev,
        { id, x: gx, y: gy, text: "", done: false },
      ]);
      setEditingId(id);
      setSelectedIds(new Set());
    },
    [scale, offset],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (menuOpen) {
        setMenuOpen(false);
        return;
      }
      const onNode = (e.target as HTMLElement).closest(".todo-node");
      if (e.button === 1 || (e.button === 0 && !onNode && !e.ctrlKey)) {
        e.preventDefault();
        setSelectedIds(new Set());
        setPanning({
          startMouse: { x: e.clientX, y: e.clientY },
          startOffset: { ...offset },
        });
      }
      if (e.button === 0 && !onNode && e.ctrlKey) {
        e.preventDefault();
        setMarquee({
          startScreen: { x: e.clientX, y: e.clientY },
          endScreen: { x: e.clientX, y: e.clientY },
        });
      }
    },
    [offset, menuOpen],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (panning) {
        setOffset({
          x: panning.startOffset.x + e.clientX - panning.startMouse.x,
          y: panning.startOffset.y + e.clientY - panning.startMouse.y,
        });
      }
      if (marquee) {
        setMarquee((prev) =>
          prev ? { ...prev, endScreen: { x: e.clientX, y: e.clientY } } : null,
        );
      }
      if (dragging) {
        const dx = e.clientX - dragging.startMouse.x;
        const dy = e.clientY - dragging.startMouse.y;
        setItems((prev) =>
          prev.map((it) =>
            it.id === dragging.id
              ? {
                  ...it,
                  x: snapWorld(dragging.startPos.x + dx / scale),
                  y: snapWorld(dragging.startPos.y + dy / scale),
                }
              : it,
          ),
        );
      }
      if (multiDrag) {
        const dx = e.clientX - multiDrag.startMouse.x;
        const dy = e.clientY - multiDrag.startMouse.y;
        setItems((prev) =>
          prev.map((it) => {
            const sp = multiDrag.startPositions[it.id];
            if (!sp) return it;
            return {
              ...it,
              x: snapWorld(sp.x + dx / scale),
              y: snapWorld(sp.y + dy / scale),
            };
          }),
        );
      }
    },
    [panning, marquee, dragging, multiDrag, scale],
  );

  const onMouseUp = useCallback(
    (_e: React.MouseEvent) => {
      if (marquee) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const minWX = toWorld(
          Math.min(marquee.startScreen.x, marquee.endScreen.x) - rect.left,
          scale,
          offset.x,
        );
        const maxWX = toWorld(
          Math.max(marquee.startScreen.x, marquee.endScreen.x) - rect.left,
          scale,
          offset.x,
        );
        const minWY = toWorld(
          Math.min(marquee.startScreen.y, marquee.endScreen.y) - rect.top,
          scale,
          offset.y,
        );
        const maxWY = toWorld(
          Math.max(marquee.startScreen.y, marquee.endScreen.y) - rect.top,
          scale,
          offset.y,
        );
        const hit = new Set(
          items
            .filter(
              (it) =>
                it.x >= minWX &&
                it.x <= maxWX &&
                it.y >= minWY &&
                it.y <= maxWY,
            )
            .map((it) => it.id),
        );
        setSelectedIds(hit);
        setMarquee(null);
      }
      setPanning(null);
      setDragging(null);
      setMultiDrag(null);
    },
    [marquee, scale, offset, items],
  );

  const onNodeMouseDown = useCallback(
    (e: React.MouseEvent, id: string) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      e.stopPropagation();
      e.preventDefault();
      if (selectedIds.has(id) && selectedIds.size > 1) {
        const startPositions: Record<string, { x: number; y: number }> = {};
        items.forEach((it) => {
          if (selectedIds.has(it.id))
            startPositions[it.id] = { x: it.x, y: it.y };
        });
        setMultiDrag({
          startMouse: { x: e.clientX, y: e.clientY },
          startPositions,
        });
      } else {
        if (!selectedIds.has(id)) setSelectedIds(new Set());
        const item = items.find((it) => it.id === id)!;
        setDragging({
          id,
          startMouse: { x: e.clientX, y: e.clientY },
          startPos: { x: item.x, y: item.y },
        });
      }
    },
    [items, selectedIds],
  );

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    setEditingId((prev) => (prev === id ? null : prev));
    setSelectedIds((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
  }, []);

  const toggleDone = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, done: !it.done } : it)),
    );
  }, []);

  const navigateTo = useCallback(
    (id: string, dir: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight") => {
      const cur = items.find((it) => it.id === id);
      if (!cur) return;
      const others = items.filter((it) => it.id !== id);
      let candidates: TodoItem[];
      if (dir === "ArrowUp") candidates = others.filter((it) => it.y < cur.y);
      else if (dir === "ArrowDown")
        candidates = others.filter((it) => it.y > cur.y);
      else if (dir === "ArrowLeft")
        candidates = others.filter((it) => it.x < cur.x);
      else candidates = others.filter((it) => it.x > cur.x);
      if (!candidates.length) return;
      const isV = dir === "ArrowUp" || dir === "ArrowDown";
      candidates.sort((a, b) => {
        const ap = isV ? Math.abs(a.x - cur.x) : Math.abs(a.y - cur.y);
        const bp = isV ? Math.abs(b.x - cur.x) : Math.abs(b.y - cur.y);
        const as_ = isV ? Math.abs(a.y - cur.y) : Math.abs(a.x - cur.x);
        const bs_ = isV ? Math.abs(b.y - cur.y) : Math.abs(b.x - cur.x);
        return ap !== bp ? ap - bp : as_ - bs_;
      });
      setEditingId(candidates[0].id);
    },
    [items],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, id: string) => {
      const idx = items.findIndex((it) => it.id === id);
      const item = items[idx];
      if (e.key === "Enter") {
        e.preventDefault();
        const nid = newId();
        setItems((prev) => {
          const n = [...prev];
          n.splice(idx + 1, 0, {
            id: nid,
            x: item.x,
            y: item.y + GRID,
            text: "",
            done: false,
          });
          return n;
        });
        setEditingId(nid);
      } else if (e.key === "Tab") {
        e.preventDefault();
        const d = e.shiftKey ? -4 : 4;
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, x: it.x + d * GRID } : it)),
        );
      } else if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        deleteItem(id);
      } else if (e.key === "p" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        toggleDone(id);
      } else if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        const inp = e.currentTarget;
        const atS = inp.selectionStart === 0 && inp.selectionEnd === 0;
        const atE =
          inp.selectionStart === inp.value.length &&
          inp.selectionEnd === inp.value.length;
        const isH = e.key === "ArrowLeft" || e.key === "ArrowRight";
        if (
          !isH ||
          (e.key === "ArrowLeft" && atS) ||
          (e.key === "ArrowRight" && atE)
        ) {
          e.preventDefault();
          navigateTo(
            id,
            e.key as "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight",
          );
        }
      } else if (e.key === "Escape") {
        setEditingId(null);
      }
    },
    [items, deleteItem, toggleDone, navigateTo],
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  const marqueeRect = marquee
    ? {
        left: Math.min(marquee.startScreen.x, marquee.endScreen.x),
        top: Math.min(marquee.startScreen.y, marquee.endScreen.y),
        width: Math.abs(marquee.endScreen.x - marquee.startScreen.x),
        height: Math.abs(marquee.endScreen.y - marquee.startScreen.y),
      }
    : null;

  const dotSize = Math.max(0.5, scale);
  const gridSpacing = GRID * scale;
  const isMultiDragging = multiDrag !== null;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#f9f9f9",
        fontFamily: "monospace",
      }}
    >
      {/* ── Menu button (top-left) ─────────────────────────────────────── */}
      <div style={{ position: "fixed", top: 12, left: 12, zIndex: 100 }}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            width: 36,
            height: 36,
            border: "1px solid #ccc",
            borderRadius: 6,
            background: menuOpen ? "#f0f0f0" : "#fff",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            padding: 0,
          }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                display: "block",
                width: 16,
                height: 1.5,
                background: "#555",
                borderRadius: 1,
              }}
            />
          ))}
        </button>

        {/* ── Dropdown ──────────────────────────────────────────────────── */}
        {menuOpen && (
          <div
            style={{
              position: "absolute",
              top: 42,
              left: 0,
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 6,
              boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
              minWidth: 200,
              overflow: "hidden",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Canvas list */}
            {canvases.length === 0 && (
              <div
                style={{ padding: "10px 14px", fontSize: 12, color: "#aaa" }}
              >
                no canvases yet
              </div>
            )}
            {canvases.map((c) => (
              <div
                key={c.id}
                onClick={() => loadCanvas(c)}
                style={{
                  padding: "8px 14px",
                  fontSize: 13,
                  cursor: "pointer",
                  background:
                    currentCanvas?.id === c.id ? "#f5f5f5" : "transparent",
                  color: currentCanvas?.id === c.id ? "#222" : "#444",
                  fontWeight: currentCanvas?.id === c.id ? 600 : 400,
                  borderLeft:
                    currentCanvas?.id === c.id
                      ? "2px solid #888"
                      : "2px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (currentCanvas?.id !== c.id)
                    (e.currentTarget as HTMLDivElement).style.background =
                      "#fafafa";
                }}
                onMouseLeave={(e) => {
                  if (currentCanvas?.id !== c.id)
                    (e.currentTarget as HTMLDivElement).style.background =
                      "transparent";
                }}
              >
                {c.name}
              </div>
            ))}

            {/* Divider */}
            <div style={{ height: 1, background: "#eee", margin: "4px 0" }} />

            {/* New canvas */}
            {!creatingCanvas ? (
              <div
                onClick={() => setCreatingCanvas(true)}
                style={{
                  padding: "8px 14px",
                  fontSize: 13,
                  cursor: "pointer",
                  color: "#666",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    "#fafafa";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    "transparent";
                }}
              >
                + new canvas
              </div>
            ) : (
              <div style={{ padding: "6px 10px", display: "flex", gap: 6 }}>
                <input
                  ref={newCanvasInputRef}
                  value={newCanvasName}
                  onChange={(e) => setNewCanvasName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateCanvas();
                    if (e.key === "Escape") {
                      setCreatingCanvas(false);
                      setNewCanvasName("");
                    }
                  }}
                  placeholder="canvas name"
                  style={{
                    flex: 1,
                    fontSize: 12,
                    border: "1px solid #ccc",
                    borderRadius: 4,
                    padding: "4px 6px",
                    fontFamily: "monospace",
                    outline: "none",
                  }}
                />
                <button
                  onClick={handleCreateCanvas}
                  style={{
                    fontSize: 12,
                    border: "1px solid #ccc",
                    borderRadius: 4,
                    padding: "4px 8px",
                    cursor: "pointer",
                    background: "#fff",
                  }}
                >
                  ok
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Canvas name label ──────────────────────────────────────────── */}
      {currentCanvas && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 12,
            color: "#bbb",
            pointerEvents: "none",
            zIndex: 90,
            letterSpacing: "0.05em",
          }}
        >
          {currentCanvas.name}
        </div>
      )}

      {/* ── Main canvas area ───────────────────────────────────────────── */}
      <div
        style={{
          width: "100%",
          height: "100%",
          cursor: panning ? "grabbing" : marquee ? "crosshair" : "default",
          userSelect: "none",
        }}
        ref={canvasRef}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {/* Grid dots */}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          <defs>
            <pattern
              id="grid"
              x={offset.x % gridSpacing}
              y={offset.y % gridSpacing}
              width={gridSpacing}
              height={gridSpacing}
              patternUnits="userSpaceOnUse"
            >
              <circle cx={0} cy={0} r={dotSize} fill="#ccc" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* World layer */}
        <div
          style={{
            position: "absolute",
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const isDraggingThis =
              dragging?.id === item.id || (isMultiDragging && isSelected);
            return (
              <div
                key={item.id}
                className="todo-node"
                style={{
                  position: "absolute",
                  left: item.x,
                  top: item.y,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#fff",
                  border: isSelected ? "1px solid #888" : "1px solid #d0d0d0",
                  borderRadius: 4,
                  padding: "3px 8px",
                  cursor: isDraggingThis ? "grabbing" : "grab",
                  boxShadow: isDraggingThis
                    ? "0 4px 12px rgba(0,0,0,0.15)"
                    : isSelected
                      ? "0 0 0 2px rgba(0,0,0,0.08)"
                      : "0 1px 3px rgba(0,0,0,0.06)",
                  minWidth: 120,
                  whiteSpace: "nowrap",
                  outline:
                    isSelected && !isDraggingThis ? "1.5px solid #aaa" : "none",
                  outlineOffset: 2,
                }}
                onMouseDown={(e) => onNodeMouseDown(e, item.id)}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingId(item.id);
                  setSelectedIds(new Set());
                }}
              >
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => toggleDone(item.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    cursor: "pointer",
                    accentColor: "#555",
                    flexShrink: 0,
                  }}
                />
                {editingId === item.id ? (
                  <input
                    ref={(el) => {
                      inputRefs.current[item.id] = el;
                    }}
                    value={item.text}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((it) =>
                          it.id === item.id
                            ? { ...it, text: e.target.value }
                            : it,
                        ),
                      )
                    }
                    onKeyDown={(e) => onKeyDown(e, item.id)}
                    onBlur={() => setEditingId(null)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      fontFamily: "monospace",
                      fontSize: 13,
                      width: Math.max(80, item.text.length * 8),
                      minWidth: 80,
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: 13,
                      color: item.done ? "#aaa" : "#222",
                      textDecoration: item.done ? "line-through" : "none",
                      minWidth: 80,
                      display: "inline-block",
                    }}
                  >
                    {item.text || <span style={{ color: "#bbb" }}>…</span>}
                  </span>
                )}
                {hoveredId === item.id && editingId !== item.id && (
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteItem(item.id);
                    }}
                    title="Delete (Ctrl+D)"
                    style={{
                      marginLeft: 2,
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      color: "#bbb",
                      fontSize: 12,
                      lineHeight: 1,
                      padding: "0 2px",
                      flexShrink: 0,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Marquee */}
        {marqueeRect && marqueeRect.width > 2 && marqueeRect.height > 2 && (
          <div
            style={{
              position: "fixed",
              left: marqueeRect.left,
              top: marqueeRect.top,
              width: marqueeRect.width,
              height: marqueeRect.height,
              border: "1px dashed #888",
              background: "rgba(100,100,100,0.06)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
    </div>
  );
}
