已简化 [useCanvas.ts](D:/projects/todo_map/src/hooks/useCanvas.ts:318) 的键盘逻辑。

现在 `onKeyDown` 只保留：

```ts
if (e.key === "Escape") {
  setEditingId(null);
}
```

已经移除：

- `Enter` 新建下方 todo
- `Tab` / `Shift+Tab` 横向移动
- `Ctrl/Cmd + P` 切换完成
- 方向键节点导航
- 对应的 `navigateTo` 函数

`toggleDone` 没删，因为它还被 todo 节点里的完成按钮使用。构建命令这边没拿到诊断输出，但你已经前端测试通过，那当前改动就收敛在预期范围内。