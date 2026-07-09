components/
  Header.tsx：包含那个可点击的菜单按钮以及中间显示的canvas名称
  TodoItem.tsx: 就是单个的todo item
  Canvas.tsx: 规划展示，可操控所有的todo item

App.tsx：
  负责和后端沟通并且根据用户切换canvas的选择来操控Canvas组件以及展示的数据，还有Header展示的数据，提供很多todo item给canvas

css/
  Header.css：就是写对应的css
  TodoItem.css：对应的css
  Canvas.css：对应的css代码

main.tsx: 在这里引用所有css代码
