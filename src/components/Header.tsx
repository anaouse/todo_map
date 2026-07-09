import { useRef, useEffect } from "react";
import type { CanvasMeta } from "../types";

interface HeaderProps {
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  canvases: CanvasMeta[];
  currentCanvas: CanvasMeta | null;
  newCanvasName: string;
  setNewCanvasName: (v: string) => void;
  creatingCanvas: boolean;
  setCreatingCanvas: (v: boolean) => void;
  handleCreateCanvas: () => void;
  loadCanvas: (meta: CanvasMeta) => void;
}

export default function Header({
  menuOpen,
  setMenuOpen,
  canvases,
  currentCanvas,
  newCanvasName,
  setNewCanvasName,
  creatingCanvas,
  setCreatingCanvas,
  handleCreateCanvas,
  loadCanvas,
}: HeaderProps) {
  const newCanvasInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (creatingCanvas) newCanvasInputRef.current?.focus();
  }, [creatingCanvas]);

  return (
    <div className="topbar">
      {/* Menu button */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={`menu-btn${menuOpen ? " open" : ""}`}
        >
          {[0, 1, 2].map((i) => (
            <span key={i} className="menu-btn-line" />
          ))}
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <div className="dropdown" onMouseDown={(e) => e.stopPropagation()}>
            {canvases.length === 0 && (
              <div className="dropdown-empty">no canvases yet</div>
            )}
            {canvases.map((c) => (
              <div
                key={c.id}
                onClick={() => loadCanvas(c)}
                className={`dropdown-item${currentCanvas?.id === c.id ? " active" : ""}`}
              >
                {c.name}
              </div>
            ))}
            <div className="dropdown-divider" />
            {!creatingCanvas ? (
              <div onClick={() => setCreatingCanvas(true)} className="dropdown-new-btn">
                + new canvas
              </div>
            ) : (
              <div className="dropdown-new-form">
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
                  className="dropdown-new-input"
                />
                <button onClick={handleCreateCanvas} className="dropdown-new-ok">
                  ok
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Canvas title — centered in the bar */}
      {currentCanvas && (
        <div className="canvas-title">{currentCanvas.name}</div>
      )}
    </div>
  );
}
