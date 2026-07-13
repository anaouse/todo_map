# 1000 lines

不变量和数据类型写到一个文件里面

看App.tsx 和Header.tsx就可以感受到react的大概写法，App有很多东西，然后子组件要用的话就要用props传进去

## Canvas那一段

item.x/y (数据，永远不变)
   ↓ (getItemProps 转成 style.left/top)
world 内部，卡片按原始坐标绝对定位
   ↓ (world 的 transform: scale(scale))
整个内容图层被视觉放大/缩小
   ↓ (size-wrapper 的 width/height 按同一个 scale 撑开)
scroll-area 的可滚动范围同步变大/变小
   ↓ (浏览器原生 overflow:auto 机制)
你滚动/拖拽时，浏览器自动裁剪显示"超大内容"里对应的那一块

item.x/y (数据)
  → useCanvas.getItemProps() 把它包成 style={{left, top}}
  → Canvas.tsx 用 {...getItemProps(item)} 转发给 TodoItemComponent
  → TodoItem.tsx 把 style 贴到 <div style={style}>
  → CSS 规则 (.world{position:relative} + .todo-node{position:absolute})
    让浏览器真正按 left/top 把这个 div 摆到 .world 内部的对应像素位置
