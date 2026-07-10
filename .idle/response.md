好问题！这恰恰是 TypeScript + React 中很经典的一个知识点。让我拆开来讲。

---

## 核心规律：TS 能推断的就不用写，不能推断的才需要显式标注

```tsx
// ✅ TypeScript 能从初始值自动推断类型
const [menuOpen, setMenuOpen] = useState(false);        // 推断为 boolean
const [newCanvasName, setNewCanvasName] = useState("");  // 推断为 string
const [creatingCanvas, setCreatingCanvas] = useState(false); // 推断为 boolean

// ❌ TypeScript 无法从初始值推断完整类型，必须显式标注
const [canvases, setCanvases] = useState<CanvasMeta[]>([]);
const [currentCanvas, setCurrentCanvas] = useState<CanvasMeta | null>(null);
```

---

## 逐个拆解

### 1. `useState<CanvasMeta[]>([])` — 为什么不能直接 `useState([])`？

因为 `useState([])` 会被 TS 推断为 `never[]`（永远为空的数组），之后你写：

```tsx
setCanvases([{ id: "1", name: "我的画布" }]);  // ❌ 类型报错！never[] 不接受任何元素
```

所以必须用 `<CanvasMeta[]>` 告诉 TS："虽然现在是空数组，但**将来**往里面放的一定是 `CanvasMeta` 类型的对象"。

> 类比：你在声明一个空盒子，同时贴上了标签 📦"这个盒子只装 CanvasMeta"。

---

### 2. `useState<CanvasMeta | null>(null)` — 为什么不能直接 `useState(null)`？

`useState(null)` 会被 TS 推断为 `null` 类型（即**永远是 null**），之后你写：

```tsx
setCurrentCanvas({ id: "1", name: "我的画布" });  // ❌ 类型报错！null 类型不接受对象
```

所以要用 `<CanvasMeta | null>` —— 这是 TypeScript 的**联合类型（Union Type）**，读作"CanvasMeta 或 null"：

```tsx
// currentCanvas 的两种合法状态：
currentCanvas = { id: "1", name: "我的画布" };  // ✅ CanvasMeta
currentCanvas = null;                            // ✅ null（没有选中任何画布）
```

---

## 一张图总结

```
初始值           TS 自动推断        是否需要显式泛型
─────────────────────────────────────────────────
false            boolean            ❌ 不需要
""               string             ❌ 不需要
[]               never[]            ✅ 需要 <CanvasMeta[]>
null             null               ✅ 需要 <CanvasMeta | null>
```

**一句话**：当初始值包含了你未来所有可能的数据形态，TS 就能自己搞定；当初始值"信息不足"（空数组不知道元素类型、null 不知道未来会变成什么），就必须手动标注。

---

## 扩展：`CanvasMeta | null` 这个模式在 React 里太常见了

几乎每一个"初始为空、稍后加载"的状态都会用这个模式：

```tsx
const [user, setUser] = useState<User | null>(null);       // 初始未登录
const [data, setData] = useState<Item[]>([]);              // 初始列表为空
const [error, setError] = useState<string | null>(null);   // 初始无错误
```

等你以后用熟了就会发现这不是花里胡哨，而是 TypeScript 帮你精确描述"这个变量的人生轨迹" 😄

---

还想继续聊 `useCanvas` 那个 545 行的 hook 吗？那才是这个项目最值得深挖的地方。