"""
FastAPI backend for TodoMap
Run: uv run uvicorn main:app --reload --port 8000

Data is stored as JSON files in ./data/<canvas_id>.json
"""

import json
import re
from pathlib import Path
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

app = FastAPI(title="TodoMap API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ──────────────────────────────────────────────────────────────────


class TodoItem(BaseModel):
    id: str
    x: float
    y: float
    text: str
    done: bool


class CanvasMeta(BaseModel):
    id: str
    name: str


class CanvasData(BaseModel):
    id: str
    name: str
    items: List[TodoItem]


# ── Helpers ──────────────────────────────────────────────────────────────────


def _safe_id(canvas_id: str) -> str:
    """Allow only alphanumeric, dash, underscore to avoid path traversal."""
    if not re.fullmatch(r"[a-zA-Z0-9_\-]+", canvas_id):
        raise HTTPException(status_code=400, detail="Invalid canvas id")
    return canvas_id


def _path(canvas_id: str) -> Path:
    return DATA_DIR / f"{canvas_id}.json"


def _load(canvas_id: str) -> CanvasData:
    p = _path(canvas_id)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Canvas not found")
    return CanvasData(**json.loads(p.read_text()))


def _save(data: CanvasData) -> None:
    _path(data.id).write_text(data.model_dump_json(indent=2))


# ── Routes ───────────────────────────────────────────────────────────────────


@app.get("/canvases", response_model=List[CanvasMeta])
def list_canvases():
    """Return all canvases (id + name only)."""
    result = []
    for p in sorted(DATA_DIR.glob("*.json")):
        try:
            raw = json.loads(p.read_text())
            result.append(CanvasMeta(id=raw["id"], name=raw["name"]))
        except Exception:
            pass
    return result


@app.post("/canvases", response_model=CanvasMeta)
def create_canvas(meta: CanvasMeta):
    """Create a new empty canvas."""
    _safe_id(meta.id)
    if _path(meta.id).exists():
        raise HTTPException(status_code=409, detail="Canvas id already exists")
    data = CanvasData(id=meta.id, name=meta.name, items=[])
    _save(data)
    return meta


@app.get("/canvases/{canvas_id}", response_model=CanvasData)
def get_canvas(canvas_id: str):
    _safe_id(canvas_id)
    return _load(canvas_id)


@app.put("/canvases/{canvas_id}/items", response_model=CanvasData)
def save_items(canvas_id: str, items: List[TodoItem]):
    """Replace the item list for a canvas (full save)."""
    _safe_id(canvas_id)
    data = _load(canvas_id)
    data.items = items
    _save(data)
    return data


@app.delete("/canvases/{canvas_id}")
def delete_canvas(canvas_id: str):
    _safe_id(canvas_id)
    p = _path(canvas_id)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Canvas not found")
    p.unlink()
    return {"ok": True}
