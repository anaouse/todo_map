现在我对全貌有了清晰的了解。让我先给你我的分析和建议。

---

## 你的设计方案评估

你的拆分思路 **大体方向是对的**，三个组件的职责划分合理：

| 组件 | 职责 | 评价 |
|------|------|------|
| **Header** | 菜单按钮 + canvas名称 | ✅ 清晰，独立性强 |
| **TodoItem** | 单个 todo 节点 | ✅ 职责单一 |
| **Canvas** | 可滚动画布世界 + 所有 item 的操控 | ✅ 核心交互层 |
| **App** | 后端通信 + 数据编排 + 状态中枢 | ✅ 典型的"容器组件"模式 |

---

## 但我有几个设计建议想和你讨论

### 1. CSS 文件放哪里？

你打算把 CSS 放到 `css/` 单独目录，但 React 社区主流做法是 **CSS 和组件放在一起**（co-location），即：

```
components/
  Header.tsx
  Header.css
  TodoItem.tsx
  TodoItem.css
  Canvas.tsx
  Canvas.css
```

好处：找文件快、删除组件时不会遗留 CSS。你确定要分开吗？还是可以接受放在一起？

### 2. Canvas 的 props 会"爆炸"

现在 App 持有大量状态（`items`, `scale`, `editingId`, `hoveredId`, `selectedIds`, `dragging`, `multiDrag`, `panning`, `marquee`, `overlappingIds`...），如果全部以 props 传给 Canvas，大概会有 **15+ 个 props + 10+ 个回调函数**。这会很难维护。

我建议两种方案：

- **方案 A（轻量）**：自定义 hook `useCanvas()` 把 Canvas 相关的状态和逻辑抽到一个 hook 里，App 调用它并传给 Canvas，保持 App 本身干净。
- **方案 B（更彻底）**：用 React Context，`App` 作为 Provider，Canvas / Header 通过 Context 消费数据。适合状态被多个层级使用的场景。

你的项目目前不算特别复杂，我倾向于 **方案 A**（hook），你怎么看？

### 3. TodoItem 与 Canvas 的交互边界需要明确

当前 TodoItem 里的逻辑相当复杂：
- 编辑输入框（`inputRefs`、`onKeyDown`、`onBlur`）
- 键盘导航跳转到另一个 item（`navigateTo`）
- 拖拽（`onNodeMouseDown`）
- 删除按钮、完成勾选

关键问题是：**键盘导航（Arrow keys）需要知道所有 item 的位置来找到下一个目标**，这个逻辑放在 TodoItem 里做不到，必须放在 App 层或 Canvas 层。所以 TodoItem 会是一个 **偏展示的组件**，大部分回调仍由 App 提供，通过 Canvas 中转。

这部分我觉得你的设计没问题——TodoItem 接收 props + callbacks，不做重逻辑。

### 4. `overlappingIds`（重叠检测）放哪里？

这个 `useMemo` 依赖 `items`，用于给重叠的 item 加红色边框。它天然属于 Canvas 层（因为只有 Canvas 关心渲染效果），可以从 App 移到 Canvas 内部计算。

---

## 我的建议计划

按以下顺序来做（由易到难，逐步验证）：

```
第1步：抽 Header  → 改动最小，立即验证
第2步：抽 TodoItem → 明确单个 item 的 props 接口
第3步：抽 Canvas   → 把画布世界整体移出
第4步：整理 App    → 精简后的 App + 抽取 useCanvas hook（可选）
第5步：整理 CSS    → 从 App.css 拆分到各自组件
```

---

你觉得这个方向可以吗？有几个问题想听你的想法：

1. CSS 文件 **和组件放一起** 还是 **单独 `css/` 目录**？
2. 是否接受 **自定义 hook（useCanvas）** 来避免 props 过多？
3. 要不要我直接开始从第 1 步动手？