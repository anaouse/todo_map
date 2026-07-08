三处改动全部到位，验证通过。总结：

| 位置 | 改动 |
|---|---|
| **第 257 行** — `onMouseDown` | `e.button === 0` → `e.button === 2`，pan 改为右键触发 |
| **第 356 行** — `onNodeMouseDown` | 新增 `e.button !== 0` 提前 return，只有左键能拖 item |
| **第 588 行** — scroll area div | 新增 `onContextMenu` preventDefault，阻止右键菜单弹出 |

现在的交互逻辑：

- **左键空白区域** → 无操作（之前是 pan，现在移除了）
- **左键 item** → 拖动 item
- **Ctrl + 左键空白区域** → 框选（不变）
- **右键空白区域 / item** → 拖动 canvas 视图（pan），不会误触 item

可以测试一下效果了。