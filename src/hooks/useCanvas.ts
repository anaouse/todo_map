import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { TodoItem } from "../types";
import { GRID, CANVAS_W, CANVAS_H } from "../constants";

// ── Helpers ──────────────────────────────────────────────────────────────────

function snapWorld(w: number) {
  return Math.round(w / GRID) * GRID;
}

let idCounter = Date.now();
function newId() {
  return `todo-${++idCounter}`;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export default function useCanvas(
  items: TodoItem[],
  setItems: React.Dispatch<React.SetStateAction<TodoItem[]>>,
  menuOpen: boolean,
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>,
) {
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
  const editingIdRef = useRef<string | null>(null);
  editingIdRef.current = editingId;

  // ── Focus input when editingId changes ─────────────────────────────────────

  useEffect(() => {
    if (editingId && inputRefs.current[editingId]) {
      inputRefs.current[editingId]?.focus();
    }
  }, [editingId]);

  // ── Refocus input on window focus / visibility change ──────────────────────

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

  // ── Mouse position helpers ─────────────────────────────────────────────────

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const scroll = scrollRef.current!;
      const rect = scroll.getBoundingClientRect();
      return {
        x: (clientX - rect.left + scroll.scrollLeft) / scale,
        y: (clientY - rect.top + scroll.scrollTop) / scale,
      };
    },
    [scale],
  );

  // ── Wheel zoom ─────────────────────────────────────────────────────────────

  const onWheel = useCallback(
    (e: WheelEvent) => {
      const scroll = scrollRef.current!;
      if (e.ctrlKey) {
        e.preventDefault();
        const rect = scroll.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(2.5, Math.max(0.3, scale * delta));
        const ratio = newScale / scale;
        scroll.scrollLeft = (scroll.scrollLeft + mx) * ratio - mx;
        scroll.scrollTop = (scroll.scrollTop + my) * ratio - my;
        setScale(newScale);
      }
    },
    [scale],
  );

  useEffect(() => {
    const el = scrollRef.current!;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // ── Canvas interactions ────────────────────────────────────────────────────

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
    [clientToWorld, setItems],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (menuOpen) {
        setMenuOpen(false);
        return;
      }
      const onNode = (e.target as HTMLElement).closest(".todo-node");
      if (e.button === 2 && !onNode) {
        setSelectedIds(new Set());
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
    [menuOpen, setMenuOpen],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (panning) {
        const scroll = scrollRef.current!;
        scroll.scrollLeft =
          panning.startScroll.x - (e.clientX - panning.startMouse.x);
        scroll.scrollTop =
          panning.startScroll.y - (e.clientY - panning.startMouse.y);
      }
      if (marquee) {
        setMarquee((prev) =>
          prev ? { ...prev, endScreen: { x: e.clientX, y: e.clientY } } : null,
        );
      }
      if (dragging) {
        const { x: wx, y: wy } = clientToWorld(e.clientX, e.clientY);
        const dx =
          wx - clientToWorld(dragging.startMouse.x, dragging.startMouse.y).x;
        const dy =
          wy - clientToWorld(dragging.startMouse.x, dragging.startMouse.y).y;
        setItems((prev) =>
          prev.map((it) =>
            it.id === dragging.id
              ? {
                  ...it,
                  x: Math.max(
                    0,
                    Math.min(CANVAS_W - 200, snapWorld(dragging.startPos.x + dx)),
                  ),
                  y: Math.max(
                    0,
                    Math.min(CANVAS_H - 40, snapWorld(dragging.startPos.y + dy)),
                  ),
                }
              : it,
          ),
        );
      }
      if (multiDrag) {
        const { x: wx, y: wy } = clientToWorld(e.clientX, e.clientY);
        const { x: sx, y: sy } = clientToWorld(
          multiDrag.startMouse.x,
          multiDrag.startMouse.y,
        );
        const dx = wx - sx;
        const dy = wy - sy;
        setItems((prev) =>
          prev.map((it) => {
            const sp = multiDrag.startPositions[it.id];
            if (!sp) return it;
            return {
              ...it,
              x: Math.max(
                0,
                Math.min(CANVAS_W - 200, snapWorld(sp.x + dx)),
              ),
              y: Math.max(
                0,
                Math.min(CANVAS_H - 40, snapWorld(sp.y + dy)),
              ),
            };
          }),
        );
      }
    },
    [marquee, dragging, multiDrag, panning, clientToWorld, setItems],
  );

  const onMouseUp = useCallback(
    (_e: React.MouseEvent) => {
      if (marquee) {
        const scroll = scrollRef.current!;
        const rect = scroll.getBoundingClientRect();
        const toW = (cx: number, cy: number) => ({
          x: (cx - rect.left + scroll.scrollLeft) / scale,
          y: (cy - rect.top + scroll.scrollTop) / scale,
        });
        const a = toW(marquee.startScreen.x, marquee.startScreen.y);
        const b = toW(marquee.endScreen.x, marquee.endScreen.y);
        const minX = Math.min(a.x, b.x);
        const maxX = Math.max(a.x, b.x);
        const minY = Math.min(a.y, b.y);
        const maxY = Math.max(a.y, b.y);
        const hit = new Set(
          items
            .filter(
              (it) =>
                it.x >= minX && it.x <= maxX && it.y >= minY && it.y <= maxY,
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
    [marquee, items, scale],
  );

  // ── Node-level handlers ────────────────────────────────────────────────────

  const onNodeMouseDown = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (e.button !== 0) return;
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

  const deleteItem = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((it) => it.id !== id));
      setEditingId((prev) => (prev === id ? null : prev));
      setSelectedIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    },
    [setItems],
  );

  const toggleDone = useCallback(
    (id: string) => {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, done: !it.done } : it)),
      );
    },
    [setItems],
  );

  const navigateTo = useCallback(
    (
      id: string,
      dir: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight",
    ) => {
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
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  x: Math.max(0, Math.min(CANVAS_W - 200, it.x + d * GRID)),
                }
              : it,
          ),
        );
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
    [items, toggleDone, navigateTo, setItems],
  );

  // ── Overlap detection ──────────────────────────────────────────────────────

  const overlappingIds = useMemo(() => {
    const ids = new Set<string>();
    const rects = items.map((item) => ({
      id: item.id,
      left: item.x,
      top: item.y,
      right: item.x + Math.max(120, item.text.length * 8 + 60),
      bottom: item.y + 30,
    }));
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        if (
          a.left < b.right &&
          a.right > b.left &&
          a.top < b.bottom &&
          a.bottom > b.top
        ) {
          ids.add(a.id);
          ids.add(b.id);
        }
      }
    }
    return ids;
  }, [items]);

  // ── Marquee rect in world coords ───────────────────────────────────────────

  const marqueeStyle = useMemo(() => {
    if (!marquee) return null;
    const scroll = scrollRef.current;
    if (!scroll) return null;
    const rect = scroll.getBoundingClientRect();
    const toW = (cx: number, cy: number) => ({
      x: (cx - rect.left + scroll.scrollLeft) / scale,
      y: (cy - rect.top + scroll.scrollTop) / scale,
    });
    const a = toW(marquee.startScreen.x, marquee.startScreen.y);
    const b = toW(marquee.endScreen.x, marquee.endScreen.y);
    return {
      left: Math.min(a.x, b.x),
      top: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
    };
  }, [marquee, scale]);

  // ── Cursor class ───────────────────────────────────────────────────────────

  const cursorClass = panning ? "panning" : marquee ? "marqueeing" : "default";

  const isMultiDragging = multiDrag !== null;

  // ── Build per-item props ───────────────────────────────────────────────────

  const getItemProps = useCallback(
    (item: TodoItem) => {
      const id = item.id;
      const isSelected = selectedIds.has(id);
      const isDraggingThis =
        dragging?.id === id || (isMultiDragging && isSelected);

      return {
        isSelected,
        isEditing: editingId === id,
        isOverlapping: overlappingIds.has(id),
        isHovered: hoveredId === id,
        isDragging: isDraggingThis,
        style: {
          left: item.x,
          top: item.y,
          cursor: "grab" as const,
        },
        onMouseDown: (e: React.MouseEvent) => onNodeMouseDown(e, id),
        onDoubleClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          setEditingId(id);
          setSelectedIds(new Set());
        },
        onMouseEnter: () => setHoveredId(id),
        onMouseLeave: () => setHoveredId(null),
        onToggleDone: () => toggleDone(id),
        onDelete: () => deleteItem(id),
        onTextChange: (value: string) =>
          setItems((prev) =>
            prev.map((it) => (it.id === id ? { ...it, text: value } : it)),
          ),
        onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) =>
          onKeyDown(e, id),
        onBlur: () => {
          if (!document.hasFocus()) return;
          setEditingId(null);
        },
        inputRef: (el: HTMLInputElement | null) => {
          inputRefs.current[id] = el;
        },
      };
    },
    [
      selectedIds,
      dragging,
      isMultiDragging,
      editingId,
      overlappingIds,
      hoveredId,
      onNodeMouseDown,
      toggleDone,
      deleteItem,
      onKeyDown,
      setItems,
    ],
  );

  // ── Canvas-level handlers bundle ───────────────────────────────────────────

  const canvasHandlers = {
    onDoubleClick,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave: onMouseUp,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

  return {
    scrollRef,
    worldRef,
    scale,
    marqueeStyle,
    cursorClass,
    getItemProps,
    canvasHandlers,
  };
}
