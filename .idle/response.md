一切就绪。以下是完成的工作总结：

---

## 重构完成 ✅

### 文件结构

```
src/
├── types.ts              ← 共享类型 (TodoItem, CanvasMeta)
├── constants.ts          ← 常量 (GRID, CANVAS_W, CANVAS_H, API)
├── components/
│   ├── Header.tsx/css    ← 菜单按钮 + canvas 名称 + 下拉菜单
│   ├── TodoItem.tsx/css  ← 纯展示+可编辑，不关心其他 item
│   └── Canvas.tsx/css    ← 画布世界：grid + items + 框选 + 缩放
├── hooks/
│   └── useCanvas.ts      ← 所有画布交互状态与逻辑
├── App.tsx               ← 数据中枢：API + canvas列表 + items
├── App.css               ← 仅保留 app-root 布局
├── index.css
└── main.tsx              ← 统一 import 所有 CSS
```

### 行数对比

|  | 之前 | 之后 |
|------|------|------|
| **App.tsx** | 704 行 | 111 行 |
| **useCanvas.ts** | — | ~330 行 |
| **Header.tsx** | — | 109 行 |
| **TodoItem.tsx** | — | 107 行 |
| **Canvas.tsx** | — | 80 行 |

### 状态归属

| App（数据中枢） | useCanvas（画布交互） |
|---|---|
| `canvases`, `currentCanvas` | `scale`, `editingId`, `hoveredId` |
| `menuOpen`, `creatingCanvas` | `selectedIds`, `dragging`, `multiDrag` |
| `items`, `setItems` | `panning`, `marquee` |
| `saveTimer`（自动保存） | `overlappingIds`, `marqueeStyle` |
| 所有 API 调用 | 所有鼠标/键盘/滚轮 handler |

### 关键设计点

1. **TodoItem 是纯展示+可编辑** — 它接收 `isSelected`, `isDragging`, `isOverlapping` 等 boolean props，自己组合 className，键盘导航/跳转等跨 item 逻辑由 `useCanvas` 的 `navigateTo` 处理

2. **`getItemProps(item)` 模式** — `useCanvas` 暴露一个 `getItemProps` 函数，Canvas 对每个 item 调用它，返回的 props 直接展开到 `<TodoItemComponent>`

3. **CSS co-location** — 每个组件的 CSS 和 `.tsx` 放在一起，`main.tsx` 统一引用