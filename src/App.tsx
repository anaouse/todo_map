import { useState, useRef, useCallback, useEffect } from "react";

const GRID = 32;
const MIN_SCALE = 0.3;
const MAX_SCALE = 2.5;

interface TodoItem {
  id: string;
  x: number;
  y: number;
  text: string;
  done: boolean;
}

// Snap a pixel coordinate (in world space) to grid
function snapWorld(w: number) {
  return Math.round(w / GRID) * GRID;
}

// Convert screen px → world coordinate
function toWorld(px: number, scale: number, off: number) {
  return (px - off) / scale;
}

let idCounter = 0;
function newId() {
  return `todo-${++idCounter}`;
}

export default function App() {
  const [items, setItems] = useState<TodoItem[]>([]);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Single-item drag
  const [dragging, setDragging] = useState<{
    id: string;
    startMouse: { x: number; y: number };
    startPos: { x: number; y: number };
  } | null>(null);

  // Multi-item drag
  const [multiDrag, setMultiDrag] = useState<{
    startMouse: { x: number; y: number };
    startPositions: Record<string, { x: number; y: number }>;
  } | null>(null);

  // Canvas pan
  const [panning, setPanning] = useState<{
    startMouse: { x: number; y: number };
    startOffset: { x: number; y: number };
  } | null>(null);

  // Marquee selection (ctrl+drag on background)
  const [marquee, setMarquee] = useState<{
    startScreen: { x: number; y: number }; // screen px
    endScreen: { x: number; y: number };
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && inputRefs.current[editingId]) {
      inputRefs.current[editingId]?.focus();
    }
  }, [editingId]);

  // Clicking canvas background clears selection (unless marquee)
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Wheel zoom
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

  // Double-click to create
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

  // Background mousedown: ctrl → start marquee, else → pan
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const onNode = (e.target as HTMLElement).closest(".todo-node");
      if (e.button === 1 || (e.button === 0 && !onNode && !e.ctrlKey)) {
        e.preventDefault();
        clearSelection();
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
    [offset, clearSelection],
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
        const newGx = snapWorld(dragging.startPos.x + dx / scale);
        const newGy = snapWorld(dragging.startPos.y + dy / scale);
        setItems((prev) =>
          prev.map((it) =>
            it.id === dragging.id ? { ...it, x: newGx, y: newGy } : it,
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
    (e: React.MouseEvent) => {
      // Finalise marquee selection
      if (marquee) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const sx = marquee.startScreen.x - rect.left;
        const sy = marquee.startScreen.y - rect.top;
        const ex = marquee.endScreen.x - rect.left;
        const ey = marquee.endScreen.y - rect.top;

        // Marquee rect in screen px
        const minSX = Math.min(sx, ex);
        const maxSX = Math.max(sx, ex);
        const minSY = Math.min(sy, ey);
        const maxSY = Math.max(sy, ey);

        // Convert to world coords
        const minWX = toWorld(minSX, scale, offset.x);
        const maxWX = toWorld(maxSX, scale, offset.x);
        const minWY = toWorld(minSY, scale, offset.y);
        const maxWY = toWorld(maxSY, scale, offset.y);

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

  // Node mousedown: if in selection → multi-drag, else → single drag (and clear selection)
  const onNodeMouseDown = useCallback(
    (e: React.MouseEvent, id: string) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      e.stopPropagation();
      e.preventDefault();

      if (selectedIds.has(id) && selectedIds.size > 1) {
        // Multi drag
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
        // Single drag
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

      if (candidates.length === 0) return;

      const isVertical = dir === "ArrowUp" || dir === "ArrowDown";
      candidates.sort((a, b) => {
        const aPri = isVertical ? Math.abs(a.x - cur.x) : Math.abs(a.y - cur.y);
        const bPri = isVertical ? Math.abs(b.x - cur.x) : Math.abs(b.y - cur.y);
        const aSec = isVertical ? Math.abs(a.y - cur.y) : Math.abs(a.x - cur.x);
        const bSec = isVertical ? Math.abs(b.y - cur.y) : Math.abs(b.x - cur.x);
        return aPri !== bPri ? aPri - bPri : aSec - bSec;
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
        const newItem: TodoItem = {
          id: nid,
          x: item.x,
          y: item.y + GRID,
          text: "",
          done: false,
        };
        setItems((prev) => {
          const next = [...prev];
          next.splice(idx + 1, 0, newItem);
          return next;
        });
        setEditingId(nid);
      } else if (e.key === "Tab") {
        e.preventDefault();
        const delta = e.shiftKey ? -4 : 4;
        setItems((prev) =>
          prev.map((it) =>
            it.id === id ? { ...it, x: it.x + delta * GRID } : it,
          ),
        );
      } else if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        deleteItem(id);
      } else if (e.key === "p" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        toggleDone(id);
      } else if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        const input = e.currentTarget;
        const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
        const atEnd =
          input.selectionStart === input.value.length &&
          input.selectionEnd === input.value.length;
        const isHoriz = e.key === "ArrowLeft" || e.key === "ArrowRight";
        if (
          !isHoriz ||
          (e.key === "ArrowLeft" && atStart) ||
          (e.key === "ArrowRight" && atEnd)
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

  // Marquee rect in screen coords for rendering
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
        cursor: panning ? "grabbing" : marquee ? "crosshair" : "default",
        userSelect: "none",
        fontFamily: "monospace",
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

      {/* Marquee rectangle */}
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
  );
}
