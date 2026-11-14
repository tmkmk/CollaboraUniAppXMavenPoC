# Collabora Word UTS API 插件

此 UTS API 插件为 uni-app 与 uni-app x Android 页面提供 `.doc` / `.docx` 打开、UNO 命令、文本插入/替换、保存关闭和编辑器事件订阅函数。

Android 端在 `utssdk/app-android/config.json` 中依赖 Engine 0.1.4，并显式声明 AppCompat 1.7.1，以支持插件 Manifest 中 `LOActivity` 的主题资源。

```ts
import { openDocument, onEditorEvent, insertText, saveDocument } from '@/uni_modules/uni-collabora-editor'

const listenerId = onEditorEvent((event) => {
  if (event.getString('type') == 'ready') {
    insertText('由 uni-app 控制的内容')
    saveDocument()
  }
})

openDocument({
  filePath: downloaded.tempFilePath,
  userName: '张三',
  mode: 'revision'
})
```

完整参数、函数、UNO 命令、事件字段、文件路径要求和构建边界见项目文档 [`docs/UNIAPP_FUNCTION_API.md`](../../../docs/UNIAPP_FUNCTION_API.md)。

当前 Engine 依赖：`io.github.tmkmk.collabora:collabora-engine:0.1.4`，Android 最低 API 26，ABI 为 `arm64-v8a`。
