一切就绪。改动总结：

### `App.tsx`
- 引入 `useMemo`
- 新增 `overlappingIds` 计算：对所有 item 两两做矩形碰撞检测（宽 ≈ `Math.max(120, text.length*8+60)`，高 = `30px`），收集所有参与重叠的 item id 到一个 `Set` 中
- 渲染时为重叠 item 追加 `overlapping` CSS class

### `App.css`
- 新增 `.todo-node.overlapping`：红色边框 `#e53e3e` + 半透明红色背景 `rgba(255,80,80,0.08)`

现在只要两个 item 位置有重叠，它们都会变成红色，一眼就能发现。