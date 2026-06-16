import { useState, useRef, useCallback, useEffect } from "react";

const GRID = 32;
const CANVAS_W = 4000;
const CANVAS_H = 3000;
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
    startScroll: { x: number; y: number };
  } | null>(null);
  const [marquee, setMarquee] = useState<{
    startScreen: { x: number; y: number };
    endScreen: { x: number; y: number };
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newCanvasInputRef = useRef<HTMLInputElement | null>(null);
  const editingIdRef = useRef<string | null>(null);
  editingIdRef.current = editingId;

  // ── Persistence ─────────────────────────────────────────────────────────────

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
    setMenuOpen(false);
    // Scroll to top-left on canvas switch
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
      scrollRef.current.scrollLeft = 0;
    }
  }, []);

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

  useEffect(() => {
    if (creatingCanvas) newCanvasInputRef.current?.focus();
  }, [creatingCanvas]);

  // ── Focus input ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (editingId && inputRefs.current[editingId]) {
      inputRefs.current[editingId]?.focus();
    }
  }, [editingId]);

  useEffect(() => {
    const refocus = () => {
      if (editingIdRef.current && inputRefs.current[editingIdRef.current]) {
        inputRefs.current[editingIdRef.current]?.focus();
      }
    };
    window.addEventListener("focus", refocus);
    const onVisible = () => {
      if (document.visibilityState === "visible") refocus();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", refocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // ── Mouse position helpers ───────────────────────────────────────────────────

  // Convert client coords to world coords (accounting for scroll)
  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const scroll = scrollRef.current!;
    const rect = scroll.getBoundingClientRect();
    return {
      x: (clientX - rect.left + scroll.scrollLeft) / scale,
      y: (clientY - rect.top  + scroll.scrollTop)  / scale,
    };
  }, [scale]);

  // ── Wheel zoom ───────────────────────────────────────────────────────────────

  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const scroll = scrollRef.current!;
      const rect = scroll.getBoundingClientRect();
      const mx = e.clientX - rect.left; // mouse pos relative to viewport
      const my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(2.5, Math.max(0.3, scale * delta));
      // Adjust scroll so the point under the mouse stays fixed
      const ratio = newScale / scale;
      scroll.scrollLeft = (scroll.scrollLeft + mx) * ratio - mx;
      scroll.scrollTop  = (scroll.scrollTop  + my) * ratio - my;
      setScale(newScale);
    },
    [scale],
  );

  // Attach wheel listener as non-passive so preventDefault works
  useEffect(() => {
    const el = scrollRef.current!;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // ── Canvas interactions ──────────────────────────────────────────────────────

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest(".todo-node")) return;
      const { x, y } = clientToWorld(e.clientX, e.clientY);
      const gx = Math.max(0, Math.min(CANVAS_W - 200, snapWorld(x)));
      const gy = Math.max(0, Math.min(CANVAS_H - 40, snapWorld(y)));
      const id = newId();
      setItems((prev) => [
        ...prev,
        { id, x: gx, y: gy, text: "", done: false },
      ]);
      setEditingId(id);
      setSelectedIds(new Set());
    },
    [clientToWorld],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (menuOpen) {
        setMenuOpen(false);
        return;
      }
      const onNode = (e.target as HTMLElement).closest(".todo-node");
      if (e.button === 0 && !onNode && !e.ctrlKey) {
        setSelectedIds(new Set());
        // Start panning by dragging the background
        const scroll = scrollRef.current!;
        setPanning({
          startMouse: { x: e.clientX, y: e.clientY },
          startScroll: { x: scroll.scrollLeft, y: scroll.scrollTop },
        });
      }
      if (e.button === 0 && !onNode && e.ctrlKey) {
        e.preventDefault();
        const pos = { x: e.clientX, y: e.clientY };
        setMarquee({ startScreen: pos, endScreen: pos });
      }
    },
    [menuOpen],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (panning) {
        const scroll = scrollRef.current!;
        scroll.scrollLeft = panning.startScroll.x - (e.clientX - panning.startMouse.x);
        scroll.scrollTop  = panning.startScroll.y - (e.clientY - panning.startMouse.y);
      }
      if (marquee) {
        setMarquee((prev) =>
          prev ? { ...prev, endScreen: { x: e.clientX, y: e.clientY } } : null,
        );
      }
      if (dragging) {
        const { x: wx, y: wy } = clientToWorld(e.clientX, e.clientY);
        const dx = wx - clientToWorld(dragging.startMouse.x, dragging.startMouse.y).x;
        const dy = wy - clientToWorld(dragging.startMouse.x, dragging.startMouse.y).y;
        setItems((prev) =>
          prev.map((it) =>
            it.id === dragging.id
              ? {
                  ...it,
                  x: Math.max(0, Math.min(CANVAS_W - 200, snapWorld(dragging.startPos.x + dx))),
                  y: Math.max(0, Math.min(CANVAS_H - 40, snapWorld(dragging.startPos.y + dy))),
                }
              : it,
          ),
        );
      }
      if (multiDrag) {
        const { x: wx, y: wy } = clientToWorld(e.clientX, e.clientY);
        const { x: sx, y: sy } = clientToWorld(multiDrag.startMouse.x, multiDrag.startMouse.y);
        const dx = wx - sx;
        const dy = wy - sy;
        setItems((prev) =>
          prev.map((it) => {
            const sp = multiDrag.startPositions[it.id];
            if (!sp) return it;
            return {
              ...it,
              x: Math.max(0, Math.min(CANVAS_W - 200, snapWorld(sp.x + dx))),
              y: Math.max(0, Math.min(CANVAS_H - 40, snapWorld(sp.y + dy))),
            };
          }),
        );
      }
    },
    [marquee, dragging, multiDrag, panning, clientToWorld],
  );

  const onMouseUp = useCallback(
    (_e: React.MouseEvent) => {
      if (marquee) {
        const scroll = scrollRef.current!;
        const rect = scroll.getBoundingClientRect();
        const toW = (cx: number, cy: number) => ({
          x: (cx - rect.left + scroll.scrollLeft) / scale,
          y: (cy - rect.top  + scroll.scrollTop)  / scale,
        });
        const a = toW(marquee.startScreen.x, marquee.startScreen.y);
        const b = toW(marquee.endScreen.x, marquee.endScreen.y);
        const minX = Math.min(a.x, b.x);
        const maxX = Math.max(a.x, b.x);
        const minY = Math.min(a.y, b.y);
        const maxY = Math.max(a.y, b.y);
        const hit = new Set(
          items
            .filter((it) => it.x >= minX && it.x <= maxX && it.y >= minY && it.y <= maxY)
            .map((it) => it.id),
        );
        setSelectedIds(hit);
        setMarquee(null);
      }
      setPanning(null);
      setDragging(null);
      setMultiDrag(null);
    },
    [marquee, items, scale],
  );

  const onNodeMouseDown = useCallback(
    (e: React.MouseEvent, id: string) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      e.stopPropagation();
      e.preventDefault();
      if (selectedIds.has(id) && selectedIds.size > 1) {
        const startPositions: Record<string, { x: number; y: number }> = {};
        items.forEach((it) => {
          if (selectedIds.has(it.id)) startPositions[it.id] = { x: it.x, y: it.y };
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
      else if (dir === "ArrowDown") candidates = others.filter((it) => it.y > cur.y);
      else if (dir === "ArrowLeft") candidates = others.filter((it) => it.x < cur.x);
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
          prev.map((it) =>
            it.id === id
              ? { ...it, x: Math.max(0, Math.min(CANVAS_W - 200, it.x + d * GRID)) }
              : it,
          ),
        );
      } else if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        deleteItem(id);
      } else if (e.key === "p" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        toggleDone(id);
      } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const inp = e.currentTarget;
        const atS = inp.selectionStart === 0 && inp.selectionEnd === 0;
        const atE = inp.selectionStart === inp.value.length && inp.selectionEnd === inp.value.length;
        const isH = e.key === "ArrowLeft" || e.key === "ArrowRight";
        if (!isH || (e.key === "ArrowLeft" && atS) || (e.key === "ArrowRight" && atE)) {
          e.preventDefault();
          navigateTo(id, e.key as "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight");
        }
      } else if (e.key === "Escape") {
        setEditingId(null);
      }
    },
    [items, deleteItem, toggleDone, navigateTo],
  );

  // ── Marquee rect in scroll-relative coords ────────────────────────────────

  const marqueeStyle = (() => {
    if (!marquee) return null;
    const scroll = scrollRef.current;
    if (!scroll) return null;
    const rect = scroll.getBoundingClientRect();
    const toW = (cx: number, cy: number) => ({
      x: (cx - rect.left + scroll.scrollLeft) / scale,
      y: (cy - rect.top  + scroll.scrollTop)  / scale,
    });
    const a = toW(marquee.startScreen.x, marquee.startScreen.y);
    const b = toW(marquee.endScreen.x, marquee.endScreen.y);
    return {
      left: Math.min(a.x, b.x),
      top: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
    };
  })();

  const isMultiDragging = multiDrag !== null;

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#f9f9f9", fontFamily: "monospace" }}>

      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <div style={{
        position: "relative",
        zIndex: 200,
        height: 48,
        flexShrink: 0,
        background: "#f9f9f9",
        borderBottom: "1px solid #e8e8e8",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
      }}>
        {/* Menu button */}
        <div style={{ position: "relative" }}>
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
              <span key={i} style={{ display: "block", width: 16, height: 1.5, background: "#555", borderRadius: 1 }} />
            ))}
          </button>

          {/* Dropdown */}
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
                zIndex: 300,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {canvases.length === 0 && (
                <div style={{ padding: "10px 14px", fontSize: 12, color: "#aaa" }}>no canvases yet</div>
              )}
              {canvases.map((c) => (
                <div
                  key={c.id}
                  onClick={() => loadCanvas(c)}
                  style={{
                    padding: "8px 14px",
                    fontSize: 13,
                    cursor: "pointer",
                    background: currentCanvas?.id === c.id ? "#f5f5f5" : "transparent",
                    color: currentCanvas?.id === c.id ? "#222" : "#444",
                    fontWeight: currentCanvas?.id === c.id ? 600 : 400,
                    borderLeft: currentCanvas?.id === c.id ? "2px solid #888" : "2px solid transparent",
                  }}
                  onMouseEnter={(e) => { if (currentCanvas?.id !== c.id) (e.currentTarget as HTMLDivElement).style.background = "#fafafa"; }}
                  onMouseLeave={(e) => { if (currentCanvas?.id !== c.id) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                >
                  {c.name}
                </div>
              ))}
              <div style={{ height: 1, background: "#eee", margin: "4px 0" }} />
              {!creatingCanvas ? (
                <div
                  onClick={() => setCreatingCanvas(true)}
                  style={{ padding: "8px 14px", fontSize: 13, cursor: "pointer", color: "#666" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#fafafa"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
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
                      if (e.key === "Escape") { setCreatingCanvas(false); setNewCanvasName(""); }
                    }}
                    placeholder="canvas name"
                    style={{ flex: 1, fontSize: 12, border: "1px solid #ccc", borderRadius: 4, padding: "4px 6px", fontFamily: "monospace", outline: "none" }}
                  />
                  <button
                    onClick={handleCreateCanvas}
                    style={{ fontSize: 12, border: "1px solid #ccc", borderRadius: 4, padding: "4px 8px", cursor: "pointer", background: "#fff" }}
                  >
                    ok
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Canvas title — centered in the bar */}
        {currentCanvas && (
          <div style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 12,
            color: "#bbb",
            pointerEvents: "none",
            letterSpacing: "0.05em",
          }}>
            {currentCanvas.name}
          </div>
        )}
      </div>

      {/* ── Scrollable canvas area ─────────────────────────────────────── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: "auto",
          cursor: panning ? "grabbing" : marquee ? "crosshair" : "grab",
          userSelect: "none",
          position: "relative",
        }}
        onDoubleClick={onDoubleClick}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {/* Fixed-size world */}
        {/* Size wrapper expands to match scaled world so scrollbars are correct */}
        <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, position: "relative", flexShrink: 0 }}>
        <div
          ref={worldRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: CANVAS_W,
            height: CANVAS_H,
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          {/* Grid dots */}
          <svg
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
          >
            <defs>
              <pattern id="grid" x={0} y={0} width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                <circle cx={0} cy={0} r={0.8} fill="#ccc" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Todo nodes */}
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const isDraggingThis = dragging?.id === item.id || (isMultiDragging && isSelected);
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
                  outline: isSelected && !isDraggingThis ? "1.5px solid #aaa" : "none",
                  outlineOffset: 2,
                  zIndex: isDraggingThis ? 10 : 1,
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
                  style={{ cursor: "pointer", accentColor: "#555", flexShrink: 0 }}
                />
                {editingId === item.id ? (
                  <input
                    ref={(el) => { inputRefs.current[item.id] = el; }}
                    value={item.text}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((it) => (it.id === item.id ? { ...it, text: e.target.value } : it)),
                      )
                    }
                    onKeyDown={(e) => onKeyDown(e, item.id)}
                    onBlur={() => {
                      if (!document.hasFocus()) return;
                      setEditingId(null);
                    }}
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
                  <span style={{
                    fontSize: 13,
                    color: item.done ? "#aaa" : "#222",
                    textDecoration: item.done ? "line-through" : "none",
                    minWidth: 80,
                    display: "inline-block",
                  }}>
                    {item.text || <span style={{ color: "#bbb" }}>…</span>}
                  </span>
                )}
                {hoveredId === item.id && editingId !== item.id && (
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
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

          {/* Marquee */}
          {marqueeStyle && marqueeStyle.width > 2 && marqueeStyle.height > 2 && (
            <div
              style={{
                position: "absolute",
                left: marqueeStyle.left,
                top: marqueeStyle.top,
                width: marqueeStyle.width,
                height: marqueeStyle.height,
                border: "1px dashed #888",
                background: "rgba(100,100,100,0.06)",
                pointerEvents: "none",
                zIndex: 50,
              }}
            />
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
