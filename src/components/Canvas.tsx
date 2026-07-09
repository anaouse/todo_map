import type { TodoItem } from "../types";
import { CANVAS_W, CANVAS_H, GRID } from "../constants";
import useCanvas from "../hooks/useCanvas";
import TodoItemComponent from "./TodoItem";

interface CanvasProps {
  items: TodoItem[];
  setItems: React.Dispatch<React.SetStateAction<TodoItem[]>>;
  menuOpen: boolean;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function Canvas({
  items,
  setItems,
  menuOpen,
  setMenuOpen,
}: CanvasProps) {
  const {
    scrollRef,
    worldRef,
    scale,
    marqueeStyle,
    cursorClass,
    getItemProps,
    canvasHandlers,
  } = useCanvas(items, setItems, menuOpen, setMenuOpen);

  return (
    <div
      ref={scrollRef}
      className={`scroll-area ${cursorClass}`}
      {...canvasHandlers}
    >
      <div
        className="size-wrapper"
        style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }}
      >
        <div
          ref={worldRef}
          className="world"
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            transform: `scale(${scale})`,
          }}
        >
          {/* Grid dots */}
          <svg className="grid-svg">
            <defs>
              <pattern
                id="grid"
                x={0}
                y={0}
                width={GRID}
                height={GRID}
                patternUnits="userSpaceOnUse"
              >
                <circle cx={0} cy={0} r={0.8} fill="#ccc" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Todo nodes */}
          {items.map((item) => (
            <TodoItemComponent key={item.id} item={item} {...getItemProps(item)} />
          ))}

          {/* Marquee */}
          {marqueeStyle && marqueeStyle.width > 2 && marqueeStyle.height > 2 && (
            <div className="marquee" style={marqueeStyle} />
          )}
        </div>
      </div>
    </div>
  );
}
