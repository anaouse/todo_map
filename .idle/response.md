TypeScript 编译通过，零错误。总结一下改动：

| 文件 | 改动 |
|---|---|
| `vite.config.ts` | 补上 `import path from 'path'`（原配置漏了） |
| `App.tsx` | `./types` → `@/types`，`./constants` → `@/constants`，`./components/...` → `@/components/...` |
| `main.tsx` | `./App` → `@/App`，所有 `./....css` → `@/....css` |
| `components/Canvas.tsx` | `../types` → `@/types`，`../constants` → `@/constants`，`../hooks/useCanvas` → `@/hooks/useCanvas`，`./TodoItem` → `@/components/TodoItem` |
| `components/Header.tsx` | `../types` → `@/types` |
| `components/TodoItem.tsx` | `../types` → `@/types` |
| `hooks/useCanvas.ts` | `../types` → `@/types`，`../constants` → `@/constants` |

现在 `src/` 下所有内部引用统一使用 `@/` 前缀，不再有相对路径了。