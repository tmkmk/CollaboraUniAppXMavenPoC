# mac-collabora-editor

uni-app / uni-app x Android 插件，通过函数 API 打开和控制 Collabora Writer，支持 `.doc`、`.docx`。

## 运行方式

插件 Maven 依赖为 `io.github.tmkmk.collabora:collabora-engine:0.1.6`。这是轻量核心 AAR，保留 Android Activity、布局、主题和核心 JNI 库；Writer Web 资源及其余 Engine `.so` 由应用首次运行时从 Vue 传入的 HTTPS 前缀下载。插件内不写服务器地址。

运行时 ZIP 文件名固定为 `collabora-engine-runtime-0.1.4-arm64-v8a.zip`。服务器目录应能直接访问：

```text
<resourceBaseUrl>/collabora-engine-runtime-0.1.4-arm64-v8a.zip
```

ZIP 内含 `assets/`、`jni/arm64-v8a/` 和 `runtime-manifest.json`。客户端首次启动时由 Java AAR 将 `assets/` 安全解压到应用私有目录，并映射 WebView 的 `file:///android_asset/` 请求；JNI 库由 UTS 加载。不要把 ZIP 放在额外子目录。

```ts
import {
  initializeEngine,
  openDocument,
  executeUnoCommand,
  insertText,
  replaceText,
  saveDocument,
  closeDocument,
  onEditorEvent,
  offEditorEvent
} from '@/uni_modules/mac-collabora-editor'

const resourceBaseUrl = 'https://example.com/appsource/'
await initializeEngine(resourceBaseUrl)
```

初始化首次下载约 147 MiB ZIP，并在应用私有目录缓存；解压后的运行时文件约 447 MiB。后续初始化复用本地缓存。卸载应用会清除缓存。每次打开文档前必须等待初始化 Promise 完成。

## API

### `initializeEngine(resourceBaseUrl: string): Promise<void>`

传入以 HTTPS 开头的资源目录地址，可带或不带结尾 `/`。下载、校验并加载 Engine 运行资源。初始化失败会 reject，可在 Vue 页面显示错误并允许用户重试。

### `openDocument(options)`

启动编辑器 Activity。示例：

```ts
openDocument({
  filePath: downloaded.tempFilePath,
  sourceUri: picked.sourceUri,
  userName: '张三',
  mode: 'revision',
  enableTrackChanges: true
})
```

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `filePath` | `string` | 必填。可读写的本地文件绝对路径或 `uni.downloadFile` 返回的临时路径。仅支持 `.doc`、`.docx`。 |
| `sourceUri` | `string` | 可选。Android 系统文件选择器返回的 `content://` URI。编辑器保存成功后，插件把 Engine 临时文件写回该 URI，并检查写入字节数与 SHA-256；写回未通过时报告失败并留在编辑器。 |
| `userName` | `string` | 修订模式下必填，作为新修订作者。 |
| `mode` | `'edit' \| 'readonly' \| 'revision'` | 默认 `edit`。`revision` 自动启用修订跟踪。 |
| `enableTrackChanges` | `boolean` | 可选。用于 `edit` 模式请求开启修订跟踪。 |
| `webOptions` | `UTSJSONObject` | 可选。转发给 Collabora Web 编辑器的额外查询参数。 |

只传 `filePath` 时，编辑器直接打开该路径；应用需确保临时下载文件在保存前未被清理。传入 `sourceUri` 时，`filePath` 应是该 URI 对应的可读本地副本。

### 文档操作

- `executeUnoCommand(command, args?, force?)`：发送通用 `.uno:` Writer 命令，返回请求 ID。命令执行结果以 Engine 能力为准。
- `insertText(text)`：在当前光标处插入文本。
- `replaceText(searchText, replaceText)`：替换文档内所有匹配文本。
- `saveDocument()`：请求保存，返回请求 ID；完成后监听 `saveCompleted`。
- `closeDocument()`：保存并返回 uni-app 页面。写回成功才返回；写回失败保留编辑器。
- `onEditorEvent(callback)` / `offEditorEvent(listenerId)`：注册/移除编辑器事件监听。

### 事件

事件是 `UTSJSONObject`，由 `event.getString(...)`、`event.getBoolean(...)` 读取字段。

| `type` | 字段 | 含义 |
| --- | --- | --- |
| `ready` | — | 文档已加载，可以调用文档操作 API。 |
| `saveCompleted` | `requestId`, `success`, `result`, `errorMsg` | Engine 保存及插件原文件写回结果。`success=true` 表示写回校验通过，或 Engine 直接保存的文件路径已成功保存。 |
| `modifiedStatus` | `modified` | Engine 报告文档是否有未保存修改。 |
| `returned` | — | 编辑器已回到 uni-app 页面。Activity 和相同文档的编辑器实例保留。 |
| `closed` | — | Activity 被系统或应用销毁；正常返回页面不应发出此事件。 |
| `commandDispatched` | `requestId`, `command` | UNO 命令已发送，不代表命令执行成功。 |

监听保存并返回：

```ts
let listenerId = ''
let requestId = ''
listenerId = onEditorEvent((event) => {
  const type = event.getString('type') ?? ''
  if (type === 'saveCompleted' && event.getString('requestId') === requestId) {
    if (event.getBoolean('success') === true) {
      console.log('原文件保存并回写成功')
    } else {
      console.error('保存失败', event.getString('errorMsg'))
    }
  } else if (type === 'returned') {
    console.log('已返回 Vue 页面；同一文档的编辑器实例仍保留')
  }
})

requestId = closeDocument()
```

编辑器左上角返回和 Android 返回键均先请求 Engine 保存；只有 Engine 返回成功且 `sourceUri` 写回验证通过，才返回 Vue 页面。重复打开相同 URI 的文档会复用保留的 Activity。重新打开不同文档时，Engine 需要切换文档，可能重建 Activity。

## 构建要求与边界

- Android API 26 及以上，当前 Engine 运行库仅包含 `arm64-v8a`。
- `config.json` 中依赖 Engine AAR 和 `androidx.appcompat:appcompat:1.7.1`。
- Maven AAR 版本、Manifest、Java/Kotlin 或 JNI 变化后，需生成包含新依赖的自定义基座；仅修改 Vue 页面或 UTS 代码不需要发布新 Maven 版本。
- `sourceUri` 必须是系统文件选择器授予应用读写权限的 `content://` URI。只读 Provider 会得到 `saveCompleted.success=false`，不会被当作写回成功。
- 初始化资源下载要求设备可访问 Vue 传入的 HTTPS 地址。应用不会访问 Google Play 或跨应用服务。

## 当前验证记录

- HBuilderX 5.34 本地 UTS 编译通过；当前模拟器已成功从传入 URL 下载 ZIP、解出 JNI 库并加载 ARM64 Engine 库。
- `0.1.6` AAR 已发布至 Maven Central；本机隔离 Android 测试壳已用该 AAR 与服务端 ZIP 打开真实 DOCX，确认 WebView 加载了 Writer 页面并渲染文档。
- uni-app 当前运行的自定义基座仍使用 `0.1.5`，出现 `file:///android_asset/dist/cool.html` 的 `ERR_FILE_NOT_FOUND`。需重新构建包含 Maven `0.1.6` 的自定义基座，再验收 uni-app 页面、原文件保存回写及返回复用。
