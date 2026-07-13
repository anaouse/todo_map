import { useState, useRef, useEffect } from "react";
import type { TodoItem, CanvasMeta } from "@/types";
import { API } from "@/constants";
import Header from "@/components/Header";
import Canvas from "@/components/Canvas";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Persistence ─────────────────────────────────────────────────────────────

  useEffect(() => {
    apiListCanvases().then(async (list) => {
      setCanvases(list);
      if (list.length > 0) {
        const meta = list[0];
        const data = await apiGetCanvas(meta.id);
        setItems(data.items ?? []);
        setCurrentCanvas(meta);
      }
    });
  }, []);

  async function loadCanvas(meta: CanvasMeta) {
    setMenuOpen(false);
    const data = await apiGetCanvas(meta.id);
    setItems(data.items ?? []);
    setCurrentCanvas(meta);
    // No need to reset scale/editing/selection here because useCanvas resets on items change
  }

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

  async function handleCreateCanvas() {
    const name = newCanvasName.trim();
    if (!name) return;
    const id = canvasId(name);
    await apiCreateCanvas(id, name);
    const meta = { id, name };
    setCanvases((prev) => [...prev, meta]);
    setNewCanvasName("");
    setCreatingCanvas(false);
    loadCanvas(meta);
  }

  return (
    <div className="app-root">
      <Header
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        canvases={canvases}
        currentCanvas={currentCanvas}
        newCanvasName={newCanvasName}
        setNewCanvasName={setNewCanvasName}
        creatingCanvas={creatingCanvas}
        setCreatingCanvas={setCreatingCanvas}
        handleCreateCanvas={handleCreateCanvas}
        loadCanvas={loadCanvas}
      />

      <Canvas
        items={items}
        setItems={setItems}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />
    </div>
  );
}
