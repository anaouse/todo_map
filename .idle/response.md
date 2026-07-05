修改完成。总结一下：

| 属性 | 作用 |
|------|------|
| `scrollbar-width: none` | 隐藏 Firefox 的滚动条 |
| `-ms-overflow-style: none` | 隐藏 IE/旧版 Edge 的滚动条 |
| `::-webkit-scrollbar { display: none }` | 隐藏 Chrome/Safari/新版 Edge 的滚动条 |

`overflow: auto` 保持不变，所以 `scrollRef.current.scrollLeft` / `scrollTop` 依然可以正常读写，你的**滚轮上下滚动、Ctrl+滚轮缩放、鼠标拖拽平移**这些功能完全不受影响——只是滚动条不再可见了。