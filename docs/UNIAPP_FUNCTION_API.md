# Collabora Word 编辑器 UTS API 使用说明

## 1. 能力范围

插件通过函数调用打开 Android 本地 Word 文档，并在 Vue 页面中控制编辑器。适用于 uni-app 和 uni-app x 的 Android App；不是嵌入式 Vue 组件，编辑器以独立 Android Activity 打开。

- 文件格式：`.doc`、`.docx`
- Android 最低版本：API 26
- 当前 Engine ABI：`arm64-v8a`
- Engine Maven 坐标：`io.github.tmkmk.collabora:collabora-engine:0.1.4`
- API 源码：`uni_modules/uni-collabora-editor/utssdk/app-android/index.uts`

页面日常需要调整的文件地址、作者姓名、打开模式、命令及命令参数都由函数参数传入。通用 `.uno:` 命令入口可复用 Engine 已支持的 Writer 命令，通常无需为增加一个页面操作而修改 AAR。

插件采用 UTS 优先的封装：`index.uts` 直接引用 Android/Java API，负责打开文件、调用参数校验、事件订阅和 UNO 命令封装；插件没有额外的 Kotlin/Java 帮助类。Engine AAR 仍必须保留 Collabora 的 `LOActivity`、WebView/Socket 消息桥、JNI 和原生 `.so`，因为这些是编辑器运行时，不是 uni-app 业务适配层。仅增加 UTS API、默认值和参数封装时，不需要发布新的 Maven AAR；若变更 AAR 内的消息桥、Activity/Manifest、JNI 或原生依赖，则需要新 Maven 版本，并让应用构建时解析新版本。

## 2. 安装与导入

将 `uni-collabora-editor` 放入项目的 `uni_modules`，在 Vue/UVue 页面导入：

```ts
import {
  openDocument,
  executeUnoCommand,
  insertText,
  replaceText,
  saveDocument,
  closeDocument,
  onEditorEvent,
  offEditorEvent
} from '@/uni_modules/uni-collabora-editor'
```

Android 构建通过插件 `utssdk/app-android/config.json` 中的 Maven 坐标解析 Engine，并显式声明 `androidx.appcompat:appcompat:1.7.1`，供插件 Manifest 中的 AppCompat Activity 主题在 UTS Library 资源校验阶段解析。Engine POM 也声明了 AppCompat 及 Material/ConstraintLayout 依赖。请使用包含插件与该 Engine 版本的自定义基座进行本地运行或打包。

## 3. `openDocument(options)`

打开 Word 文件。同步校验失败时抛出异常；成功启动编辑器后返回 `void`。打开过程和后续状态通过 `onEditorEvent` 接收。

```ts
openDocument({
  filePath: downloaded.tempFilePath,
  userName: '张三',
  mode: 'revision',
  enableTrackChanges: true,
  webOptions: {
    darkTheme: true
  }
})
```

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `filePath` | `string` | 是 | — | `uni.downloadFile` 返回的 `tempFilePath`，或当前应用有权访问的 Android 绝对文件路径。支持 `.doc`、`.docx`。 |
| `userName` | `string` | 否 | 引擎默认用户名 | 编辑器用户名。`revision` 模式必须非空，并用作新修订作者。 |
| `mode` | `'edit' \| 'readonly' \| 'revision'` | 否 | `'edit'` | 编辑、只读或修订模式。 |
| `enableTrackChanges` | `boolean` | 否 | `false` | 在 `edit` 模式下请求启用修订跟踪；`revision` 模式总是请求启用。不能在 `revision` 模式传 `false`。 |
| `webOptions` | `UTSJSONObject` | 否 | `{}` | 额外传给 Collabora Web 编辑器的查询参数。只转发字符串、数字和布尔值。 |

### 文件路径注意事项

- 推荐使用 `uni.downloadFile` 下载到应用可读写的临时目录，再把 `tempFilePath` 传给 `openDocument`。
- 以 `/` 开头的路径按 Android 绝对路径使用；其他路径由 `UTSAndroid.convert2AbsFullPath` 转成应用绝对路径。
- 文件必须真实存在且可读；编辑/修订模式还要求可写。`content://` URI、其他应用私有目录、未获授权的共享存储路径不属于本接口的文件路径格式。
- 保存写回传入的文件。若临时文件需要长期保留，请在页面侧按业务需要复制到持久目录。

### 模式说明

- `edit`：可编辑；不主动改变文档原有修订跟踪设置。
- `readonly`：只读打开，禁止编辑和保存修改。
- `revision`：可编辑，要求传入非空 `userName`，并请求开启修订跟踪。文档已有修订的显示方式由 Engine/文档状态决定；当前接口没有单独的“显示标记的最终状态”开关。

### `webOptions` 规则

键名必须以英文字母开头，后续仅允许字母、数字、下划线、点和连字符。值仅支持字符串、数字、布尔值。插件会忽略对象、数组、`null` 以及下列由引擎/插件控制的键：`file_path`、`permission`、`closebutton`、`lang`、`collaboraTrackChanges`。传入键是否生效取决于 Engine/Web 编辑器是否识别它。

## 4. 命令与文档操作

### `executeUnoCommand(command, args?, force?)`

向当前 Writer 文档发送通用 UNO 命令，返回 `requestId: string`。

```ts
const requestId = executeUnoCommand('.uno:Bold')
executeUnoCommand('.uno:InsertText', {
  Text: { type: 'string', value: '由 uni-app 插入的文字' }
})
executeUnoCommand('.uno:TrackChanges?TrackChanges:bool=true')
```

- `command` 必须以 `.uno:` 开头。
- `args` 是 UNO 参数对象，参数值采用 `{ type, value }` 结构；具体字段和值由对应 UNO 命令决定。
- `force` 可选，默认 `false`，原样传给 Engine 命令入口。
- 函数返回 ID 代表请求已发出，不代表 UNO 命令已经执行成功。当前通用命令只产生 `commandDispatched` 事件，不保证每条命令都有完成/失败回调。
- 必须等 `ready` 事件后再发命令；未就绪或已关闭时会抛出异常。

### `insertText(text)`

在当前光标位置插入文字，返回请求 ID。

```ts
insertText('追加内容')
```

### `replaceText(searchText, replaceText)`

使用 Writer 的 `.uno:ReplaceAll` 替换文档中的全部匹配内容，返回请求 ID。`searchText` 不能为空。

```ts
replaceText('旧标题', '新标题')
```

### `saveDocument()`

请求保存当前文档，返回请求 ID。保存结束后触发 `saveCompleted` 事件。

### `closeDocument()`

先请求保存，保存成功后关闭编辑器，返回请求 ID。保存结果通过 `saveCompleted` 事件报告，Activity 退出时触发 `closed` 事件。

### 可以通过通用命令调用的常见 Writer 操作

以下命令名用于说明通用入口的用法，具体可用性仍取决于文档状态、光标/选区、只读状态和 Engine 实现：

| 功能 | UNO 命令示例 |
| --- | --- |
| 撤销/重做 | `.uno:Undo` / `.uno:Redo` |
| 全选 | `.uno:SelectAll` |
| 加粗/斜体/下划线 | `.uno:Bold` / `.uno:Italic` / `.uno:Underline` |
| 启停修订跟踪 | `.uno:TrackChanges` |
| 显示修订 | `.uno:ShowTrackedChanges` |
| 接受/拒绝全部修订 | `.uno:AcceptAllTrackedChanges` / `.uno:RejectAllTrackedChanges` |
| 保存 | 推荐调用 `saveDocument()` 以取得保存结果事件 |

例如接受全部修订：

```ts
executeUnoCommand('.uno:AcceptAllTrackedChanges')
```

对有参数的命令，按 LibreOffice/Collabora 对应 UNO 命令要求提供 `args`；通用入口不会自动推导命令参数。

## 5. 编辑器事件

### 订阅和取消

请先订阅事件再打开文件，这样不会漏掉只发送一次的 `ready` 事件。

```ts
const listenerId = onEditorEvent((event) => {
  const type = event.getString('type') ?? ''
  if (type == 'ready') {
    insertText('开始编辑')
    const saveRequestId = saveDocument()
    console.log('保存请求', saveRequestId)
  } else if (type == 'saveCompleted') {
    console.log('保存结果', event.getBoolean('success'), event.getString('errorMsg'))
  } else if (type == 'modifiedStatus') {
    console.log('文档已修改', event.getBoolean('modified'))
  } else if (type == 'closed') {
    offEditorEvent(listenerId)
  }
})

openDocument({ filePath: downloaded.tempFilePath, mode: 'edit', userName: '张三' })
```

页面离开或不再需要监听时调用 `offEditorEvent(listenerId)`。多个监听器可以同时注册。

### 事件结构

每个事件都是 `UTSJSONObject`，字段 `type` 用于区分事件。

| `type` | 其他字段 | 含义 |
| --- | --- | --- |
| `ready` | — | Web 编辑器已初始化，可以发送命令。 |
| `commandDispatched` | `requestId`, `command` | 通用 UNO 命令已交给编辑器分发；不是执行成功确认。 |
| `saveCompleted` | `requestId`, `success`, `result`, `errorMsg` | 保存命令结果。`closeDocument()` 成功保存后也会收到此事件。 |
| `modifiedStatus` | `modified` | Engine 报告文档是否处于修改状态。 |
| `closed` | — | 编辑器 Activity 已关闭。 |

## 6. 可直接复制的下载、编辑、保存示例

```ts
import {
  openDocument,
  replaceText,
  saveDocument,
  onEditorEvent,
  offEditorEvent
} from '@/uni_modules/uni-collabora-editor'

function downloadAndEdit() {
  uni.downloadFile({
    url: 'https://example.com/report.docx',
    success: (result) => {
      if (result.statusCode != 200) return

      let listenerId = ''
      listenerId = onEditorEvent((event) => {
        const type = event.getString('type') ?? ''
        if (type == 'ready') {
          replaceText('待替换文本', '新的文本')
          saveDocument()
        } else if (type == 'saveCompleted') {
          const success = event.getBoolean('success') == true
          console.log(success ? '文档已保存' : '保存失败', event.getString('errorMsg'))
        } else if (type == 'closed') {
          offEditorEvent(listenerId)
        }
      })

      openDocument({
        filePath: result.tempFilePath,
        userName: '张三',
        mode: 'revision'
      })
    },
    fail: (error) => console.error('下载 Word 失败', error)
  })
}
```

## 7. Vue 页面参数与原生依赖的边界

- 页面改文件路径、用户名、模式、`webOptions`、UNO 命令/参数：只改页面调用代码，不需要修改 Maven AAR。
- 新增一个业务动作但它可由现有 `.uno:` 命令表达：直接用 `executeUnoCommand`，通常不需要改插件或 AAR。
- 新增便捷函数、参数校验、事件过滤等插件 API：改 `utssdk/app-android/index.uts` 并由 HBuilderX 编译 UTS；不需要重新发布 Engine Maven。开发运行时是否需要重装 App，取决于 HBuilderX 当前运行/基座工作流。
- 改 Engine Java/C++、WebView/Socket 桥、Manifest、JNI 或 AAR 依赖：必须构建并发布新的 Engine Maven 版本；应用需要使用包含新依赖的基座/安装包。

UTS 插件将 Android 平台代码编译为 Kotlin 原生代码，可从 UTS 直接导入 Android/Java API 和 Maven 第三方 SDK。官方文档确认 UTS API 插件可同时支持 uni-app 与 uni-app x；本仓库已对两类项目声明 Android 支持。uni-app x 项目已完成 HBuilderX UTS 与 Android Gradle 集成构建；标准 uni-app 当前完成模块编译命令检查，仍需在实际标准 uni-app App 工程上完成设备运行验收。

## 8. 当前实现文件与验证状态

- `utssdk/interface.uts`：公共类型定义。
- `utssdk/app-android/index.uts`：函数 API、Android 文件/Activity 调用、事件和命令广播实现；插件侧不再依赖单独 Kotlin helper 文件。
- `utssdk/app-android/AndroidManifest.xml`：权限与 `LOActivity` 主题声明。
- `sdk/collabora-engine/apply-unipage-options.py`：Engine Activity/Socket 消息桥补丁。
- Engine 0.1.4 候选 AAR包含 patched `LOActivity` 主类及其内部类、Socket 运行脚本，原有 arm64 JNI 资源和许可证文件保留。
- HBuilderX 5.34 UTS 编译、Android 36 AAR 元数据与 Manifest 检查、Kotlin/Java 编译及本地 APK `assembleDebug` 已通过。
- Engine 0.1.4 已在 Maven Central 发布；POM 与 AAR 公网 URL 返回 HTTP 200，AAR 为 158,623,909 bytes。签名在本地验证通过。
- 新 0.1.4 自定义基座上的真实 DOC/DOCX 打开、编辑、保存仍待 arm64 设备验收；本轮未触发云打包。

## 9. 官方参考

- [DCloud UTS 插件介绍与 Android 示例](https://uniapp.dcloud.net.cn/plugin/uts-plugin.html)
- [DCloud Android UTS 原生配置](https://uniapp.dcloud.net.cn/plugin/uts-for-android.html)
- [DCloud UTSAndroid API](https://uniapp.dcloud.net.cn/uts/utsandroid.html)
