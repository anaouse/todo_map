已修改 [scripts/start.vbs](/D:/projects/todo_map/scripts/start.vbs:21)。

现在逻辑是：启动前先检查对应端口是否已经在监听。  
如果 `11134` 后端或 `3000` 前端已经存在，就复用现有服务，不再重复启动，也就不会触发 Vite 的 `--strictPort` “端口已存在/请先停止”的提示。

另外停止提示也改成了更准确的：

```text
请运行 scripts\stop.bat 来停止服务。
```

我做过一次 `cscript //NoLogo scripts/start.vbs backend` 的语法/运行检查，脚本可正常执行。