import type { TodoItem as TodoItemType } from "../types";

interface TodoItemProps {
  item: TodoItemType;
  isSelected: boolean;
  isEditing: boolean;
  isOverlapping: boolean;
  isHovered: boolean;
  isDragging: boolean;
  style: React.CSSProperties;
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onToggleDone: () => void;
  onDelete: () => void;
  onTextChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  inputRef: (el: HTMLInputElement | null) => void;
}

export default function TodoItem({
  item,
  isSelected,
  isEditing,
  isOverlapping,
  isHovered,
  isDragging,
  style,
  onMouseDown,
  onDoubleClick,
  onMouseEnter,
  onMouseLeave,
  onToggleDone,
  onDelete,
  onTextChange,
  onKeyDown,
  onBlur,
  inputRef,
}: TodoItemProps) {
  const className = [
    "todo-node",
    isSelected && "selected",
    isDragging && "dragging",
    isEditing && "editing",
    isOverlapping && "overlapping",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      style={style}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDoubleClick={onDoubleClick}
    >
      <input
        type="checkbox"
        checked={item.done}
        onChange={onToggleDone}
        onClick={(e) => e.stopPropagation()}
        className="todo-checkbox"
      />
      {isEditing ? (
        <input
          ref={inputRef}
          value={item.text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          onClick={(e) => e.stopPropagation()}
          className="todo-edit-input"
          style={{ width: Math.max(80, item.text.length * 8) }}
        />
      ) : (
        <span
          className={`todo-text${item.done ? " done" : ""}${!item.text ? " placeholder" : ""}`}
        >
          {item.text || "…"}
        </span>
      )}
      {isHovered && !isEditing && (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete"
          className="todo-delete-btn"
        >
          ✕
        </button>
      )}
    </div>
  );
}
