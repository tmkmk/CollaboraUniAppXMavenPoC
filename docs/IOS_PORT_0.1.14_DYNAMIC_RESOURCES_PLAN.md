# Collabora 0.1.14 iOS 插件移植实施方案（重点：动态资源加载）

编制日期：2026-11-18。状态：设计及源码核对完成，iOS 实现、编译、设备验收均未完成。本文件是后续执行入口，不是已完成能力声明。

## 1. 目标与必须先明确的边界

将现用 Android Collabora Engine 0.1.14 的 Word 文档编辑能力移植到同一应用内的 iOS 插件，支持 uni-app 和 uni-app x；不跨应用调用，不以服务端在线编辑器替代本地引擎。优先实现“原生引擎随应用安装，允许外置的数据资源首次初始化下载并复用缓存”。

“功能一致”指文档打开、只读、普通编辑、修订作者、保存、返回、函数控制、进度与错误事件等合同一致，不代表 Android AAR、JNI、Activity 或原生库下载方式可以复用。

**iOS 原生引擎必须重新编译，并在构建时链接/嵌入与签名。不能把 Android `.so` 下载机制改成下载 `.dylib` 就作为可交付方案。** Apple 对下载并执行改变应用功能的代码有明确约束；编辑器 JavaScript 不能一概视为普通数据资源。本方案默认把原生引擎和执行逻辑随应用发布，把经核验可外置的字体、词典、图片、模板等数据分包下载。JS/HTML 更新不作为免重新打包的保证。[Apple 审核指南 2.5.2](https://developer.apple.com/app-store/review/guidelines/)

若后续仍要求“首次下载全部原生引擎、IPA 不带引擎”，应记录为本方案无法满足的要求，不得通过换扩展名、下载可执行包、模拟其他应用或宣传已解决来交付。

## 2. 已核对基线与源码差异

| 项目 | 本次核对结果 | 执行时处理 |
| --- | --- | --- |
| Maven 坐标 | `io.github.tmkmk.collabora:collabora-engine:0.1.14` | 冻结为 Android 对齐基线；iOS 不依赖 Maven AAR |
| 当前 Android 资源 | `collabora-engine-runtime-0.1.4-arm64-v8a-save-return5.zip` | 0.1.4 是资源标识，不能因小于 0.1.14 就认定过期 |
| 当前资源 SHA-256 文件值 | `2a3ddbf1f3bc22f98191eaa27fd3630c7a7998597e7477dba04a16a1526e1d2e` | 实施时重新计算 ZIP 哈希，不仅信任旁边的校验文件 |
| PoC 示例插件 | `uniappx-demo/uni_modules/mac-collabora-editor` 的说明仍是 0.1.6 | 不能直接认定其为 0.1.14 全量合同 |
| 现用插件参考 | `D:\Code\mdy-app\uni_modules\mac-collabora-editor` | 只读提取 API/事件基线；本任务不修改 mdy-app |
| 单入口参考 | `D:\Code\mdy-app\utils\collabora-editor.ts` 的 `editDocument` | 含 Android 专属 `plus.android`，需要平台适配；不要误用业务层 `utils/newOa/documentEditor.ts` 替换它 |
| 保存修复参考 | `sdk/collabora-engine/patch-file-uri-save.py` | 理解 file:// 直接保存与 content:// 写回的区别，移植语义而非 Java 代码 |
| 本地上游源码 HEAD | `6c172ae2c9ba34bdde6a773e81449e16a2e28a6e` | 这是检查时源码提交，尚未证明等于 0.1.14 实际编译源码；需核对发布补丁、未提交改动和引擎版本 |
| 上游 iOS 实现 | `collabora-source/online/ios/` 已存在 | 优先改造成可嵌入库，避免从零重写 Writer |

执行前建立 `docs/ios/baseline-0.1.14.json`，记录 AAR SHA-256、源码提交、实际补丁集、Web 资源提交、UTS 接口与配置文件哈希。分清“现用源代码”“已发布 AAR”“设备装载版本”，不只看版本字符串。

已发现的 iOS 嵌入风险：

- `ios/Mobile/CODocument.mm` 从主 Bundle 获取 `cool.html`，并创建内部文档副本；返回路径必须指向完成保存后的稳定副本，不能直接返回最初输入路径。
- `ios/Mobile/AppDelegate.mm` 有全局 `user_name`、清空整个宿主 tmp 目录、启动 `COOLWSD`、异常路径 `abort` 的代码。插件不得接管宿主 AppDelegate，不得删除宿主临时文件；引擎失败应进入受控错误状态。还需全量核查退出/信号处理逻辑，不能保证简单捕获 Objective-C 异常可以处理 C++ 崩溃。
- `ios/Mobile/DocumentViewController.mm` 处理 `BYE` 和保存；返回宿主不等于结束应用进程。必须按文档会话关闭与引擎进程级保留分别管理。
- `ios/Mobile.xcodeproj/project.pbxproj` 当前将 Web、`share`、`config`、RDB 和 bootstrap 文件打入资源；资源外置必须修改真实读取路径并验证，不能只从 Copy Bundle Resources 删除目录。

## 3. 动态资源分类：先分类，再决定下载

对实际 **iOS 编译产物**生成 `resource-inventory.csv`，字段：路径、文件类型、大小、SHA-256、加载者、加载阶段、是否含执行逻辑、是否必须随包、拟分包、许可证。不得把整个 Android ZIP 作为 iOS 资源。

| 类别 | 首版策略 | 动态加载条件/实现 |
| --- | --- | --- |
| Engine/Writer C++、UNO 实现、依赖库、Swift/ObjC 桥 | 随 IPA 链接或嵌入签名 Framework | 不通过初始化下载可执行原生代码 |
| UTS 编译出的 Swift、原生 UI 控制器 | 随应用构建 | 改动编译代码后需本地重建并安装 |
| `cool.html`、编辑器 JS、原生桥协议脚本 | 随包固定版本 | 首版不远程替换；任何后续远程更新须单独评估功能变更和分发规则 |
| 基础 CSS、图标与中文错误页 | 保留最小随包集合 | 可选纯主题色、图片、图标数据可外置；拒绝混入 JS/远程脚本、任意 CSS URL |
| 中文/西文字体、字体替换数据 | 动态候选 | 下载后在 Engine 初始化前提供字体目录；需要重建字体缓存时不能声称热切换已生效；核对分发授权 |
| 拼写、断词词典、纯文本本地化数据 | 动态候选 | 确认是数据格式；`.js` 格式本地化仍按脚本处理，不能只按名称判定 |
| Gallery 图片、非执行型 Word 模板 | 动态候选 | 按需下载；含宏、扩展或脚本的模板不得归入普通数据包 |
| `share/registry`、`config`、`.rdb`、bootstrap 配置 | 先随包，逐项验证后再外置 | 版本强绑定；可能引用组件/路径。外置后必须能限制组件映射和路径；不允许清单任意启用新实现 |
| 用户配置/profile | 每安装/会话本地创建 | 与下载的只读资源分离，不能在资源升级时覆盖用户配置 |
| 工作文档、编辑输出、诊断记录 | 本地独立目录 | 不属于资源包，不在更新或清缓存时删除 |
| Android JNI、Android manifest、classes.jar | iOS 不使用 | 不进入 iOS 数据分发目录 |

“先随包”是稳定功能的起点；数据资源的迁出按单组验证推进。功能需要但不可安全外置的资源继续随包，不能为减小体积静默删除能力。

### 3.1 体积核算依据

本次读取 Android `runtime-manifest.json`：13 个 `native-library` 合计 **360,875,680 字节**；6,316 个 `asset` 合计 **107,074,083 字节**，均为清单标注的未压缩大小。ZIP 文件大小为 **185,952,656 字节**。这些是 Android 参考值，**不能用于承诺 iOS IPA 大小或 iOS 可外置总量**。

iOS 交付报告分别列出：签名 IPA 大小、解包后应用大小、Mach-O 大小、随包数据大小、首次必需下载量、可选下载量、安装缓存量、更新峰值磁盘需求。比较同一配置的“全随包版”和“外置数据版”，禁用 Debug 符号对比误差；符号存储在独立归档中。不预先承诺减小百分比。

## 4. 动态加载器的具体设计

### 4.1 资源前缀与服务器结构

前缀由 Vue/TS 配置层传给已有 `initializeEngine(resourceBaseUrl)`，插件内部不写 `gjy.gzjtjt.cn`。业务 `editDocument` 仍仅接受三个参数，前缀通过业务应用配置注入其初始化适配层，不增加第四参数。

建议使用相同 HTTPS 站点下的独立 iOS 子目录，目录结构为待实现规范：

```text
<resourceBaseUrl>/ios/engine-0.1.14-data-v1/
  manifest.json
  manifest.sig
  fonts-zh-Hans-<sha256>.zip
  dictionaries-<sha256>.zip
  writer-data-<sha256>.zip
  icons-<sha256>.zip
```

服务端为普通静态 HTTPS 文件服务，支持 Content-Length、ETag 和最好支持 Range。允许前缀指向自有国内可达站点；编辑文档不上传到资源站。Android 目录继续独立使用，不覆盖原 ZIP。

清单示例仅是新协议模板，不是已发布地址；执行者必须替换占位值，不能把示例哈希当作有效清单：

```json
{
  "schemaVersion": 1,
  "platform": "ios",
  "bridgeProtocol": 1,
  "engineBuildId": "<frozen-ios-engine-build-id>",
  "resourceVersion": "ios-data-v1",
  "webBuildId": "<bundled-web-build-id>",
  "packs": [{
    "id": "fonts-zh-Hans",
    "required": true,
    "kind": "data",
    "url": "fonts-zh-Hans-<sha256>.zip",
    "compressedBytes": 0,
    "expandedBytes": 0,
    "sha256": "<64-hex>",
    "mount": "fonts/zh-Hans",
    "files": [{"path": "example.ttf", "size": 0, "sha256": "<64-hex>"}]
  }]
}
```

清单 ID/协议版本用于精确兼容，不比较 `0.1.14` 和 `0.1.4` 的大小来选择资源。`mount` 必须来自应用内白名单，清单不能指定任意系统路径。

### 4.2 本地目录与启动顺序

```text
Library/Application Support/Collabora/
  resources/<engineBuildId>/<resourceVersion>/  # 安装完成、不可变的数据
  staging/<downloadId>/                        # 下载和解包中间状态
  profiles/<engineBuildId>/                    # 可写用户配置
  sessions/<sessionId>/                        # 文档工作副本和恢复记录
  exports/<sessionId>/                         # 返回给 uni.uploadFile 的文件
  active.json                                 # 已验证资源选择器
```

可重新下载的数据标记不进入设备备份；用户编辑输出不能随之被整体排除或清除。不要存成“依赖长期存在”的 tmp 文件；系统可清除的缓存须有重下载路径。

状态机：`idle → checking → downloading → verifying → installing → initializing → ready`，失败进入 `failed`，允许显式重试。并发调用共享同一个初始化任务；取消单个进度订阅不能中断其他调用方。重试前释放旧连接、临时句柄和失败任务引用。

执行顺序：

1. 校验前缀 URL 与平台、读取随包引擎和 Web 标识，检验已安装资源清单与关键文件完整性。
2. 已有兼容完整资源时先允许离线启动，更新检查可另行进行；不能每次开文档都依赖网络。
3. 无可用缓存时用 URLSession 下载签名清单；HTTPS + 内置公钥验签（例如 CryptoKit 验证 Ed25519）。签名覆盖明确的原始字节，解析前验签，避免 JSON 重新序列化歧义；私钥只在发布端。
4. 冻结本次解析的清单，下载必需 ZIP 到 `.part`，Range 不受支持或 ETag 变化时安全重下。限制同源或明确允许的 CDN 重定向；凭据不跨域转发，不写日志。
5. 下载后核对实际长度与 SHA-256，解压前检查空间：压缩包、解压包、当前活动包、更新暂存都要计算。
6. 解压到 staging；拒绝绝对路径、`..`、符号链接越界、重复路径、过多文件和超限解压量。对下载文件做类型/路径白名单检查，不仅检查扩展名；拒绝 Mach-O、动态库、扩展及未授权脚本。
7. 校验逐文件清单后，在同一文件系统内原子提交版本目录，再原子更新 active 记录。损坏包绝不能提前写 installed 标记。
8. 通过 `ResourceLocator` 把已验证数据根目录传入原生 bootstrap、字体目录和资源读取层；所有必需挂载完成后才启动引擎。
9. 原生引擎就绪后再发出初始化成功；文档 `ready` 是另一个事件，不能以下载完成代替文档就绪。

进度沿用 `download/install/load/ready/error` 对外合同，内部可细分验证阶段；unknown Content-Length 时显示阶段和累计字节，不显示虚假完成率。校验、解压、初始化未结束时不报告 100%。所有 UI 回调在主线程，长期订阅按 DCloud UTS 回调生命周期实现并能解除。

### 4.3 缓存复用、升级及失败恢复

- 资源版本目录不可原地覆盖；活动文档固定绑定启动时版本。正在编辑时不切换字体、注册数据或 Web 资源。
- 与引擎启动绑定的数据变更，等待无文档且确认引擎支持重新初始化；否则下次进程启动激活。不得把“文件已替换”写成“新数据已加载”。
- 更新失败使用当前完整兼容数据集，不保留/恢复低于 0.1.14 的旧引擎。本条是当前版本下载事务保护，不要求做旧版功能回归。
- 无有效缓存且离线时明确报错，不能进入空白编辑器。首次需联网、后续缓存就绪可离线编辑是验收要求。
- Web 或 Engine 协议不兼容时拒绝下载/激活，返回 `RESOURCE_INCOMPATIBLE`；不能反复下载同一个不兼容包。
- 清理仅限无引用 staging/可再下载资源。不得删除 sessions/exports 或宿主 tmp；中断会话有恢复记录。
- 存储资源前缀、资源版本与错误阶段，URL 中认证参数脱敏。错误不能暴露文档内容或密码。

## 5. iOS 原生库与资源路径改造

默认架构：Vue/TS 单入口 → 平台 UTS → Swift/ObjC 接口 → Objective-C++ Bridge → 上游 iOS Engine + WKWebView。原生引擎构建为静态库集合或可嵌入 Framework，再封装 XCFramework；这一步需要新建 SDK target，上游完整 App 工程不能直接改名当 SDK。

`ResourceLocator` 必须同时区分只读 Bundle 根、下载数据根、可写 profile 根、文档会话根。对 bootstrap/注册表、字体、模板、Web 路径分别找到真实入口再传值；不能对整个 Bundle 路径做无差别字符串替换。`CODocument.mm` 的 Web 起点及 `CoolURLSchemeHandler` 的消息通道优先沿用上游，确保相对资源、CSP、字体和本地请求可用。

若使用 WKWebView 本地文件加载，读取授权目录限定在所需资源目录；不要给整个应用沙箱或外部文件系统读取权限。若扩展 URL scheme handler，只映射应用拥有且已校验的资源。[Apple WKWebView 文件加载接口](https://developer.apple.com/documentation/webkit/wkwebview/loadfileurl(_:allowingreadaccessto:))

引擎单例按进程管理、文档会话按打开次数管理；一次只允许一个编辑会话。冷启动和暖启动分开记录。优先保留 Engine 服务加速重开，必要时重建文档视图；不承诺能保留所有原生控制器。内存警告、安全返回、后台恢复和 WKWebView 内容进程终止都要有受控状态处理。

审核 UNO 调度的线程要求；不能从任意 Swift 后台线程直接调用原生文档对象。通用命令桥用结构化参数和 requestId，不拼接未经转义的 JS 字符串。普通返回不能 `exit`、`abort`、销毁 uni-app 宿主或占用其 AppDelegate 生命周期。

## 6. 对外功能合同

### 6.1 唯一业务入口

```ts
export function editDocument(
  fileAddress: string,
  mode: 'view' | 'edit' | 'review',
  userName: string
): Promise<string>
```

- `view → readonly`、`edit → edit`、`review → revision`。review 的姓名无效/去空白后为空，强制改为 edit。
- 所有可编辑输入先复制为应用自有可写工作副本；默认不覆盖远程 URL、只读来源或业务原件。
- Promise 等待编辑器返回；未修改返回 `''`；有修改且完成保存后返回适用于 `uni.uploadFile({ files: [{ name: 'file', uri: result }] })` 的本地路径。具体 `file://` 与绝对路径格式要在两个宿主实测后固定，不能只依据文件存在宣称兼容。
- 保存成功但未退出时继续等待；用户再次修改须重新保存。无修改返回不调用必然失败的保存，不弹“无法保存”。
- 修改过后保存，Engine 的 modified=false 只表示当前没有未保存变化，不能清除本次会话“曾修改”标记；自动 unmodified 回调也不能覆盖已确认的保存成功。
- 失败保留副本并返回结构化错误，不返回一个未保存的文件冒充成功。取消选择、只读返回可返回空串；异常关闭应 reject；同一 Promise 最多完成一次。
- 输出保留到业务上传完成后的既有清理策略；返回时不能同时删除。日志记录 sessionId、保存请求、输出文件大小和阶段。

### 6.2 低层插件 API 保持函数可调用

| API | iOS 对齐要求 |
| --- | --- |
| initializeEngine(baseUrl) | 下载允许外置的数据、校验、挂载并初始化；Promise |
| onEngineProgress / offEngineProgress | 可重复事件、可解除订阅、监听生命周期正确 |
| openDocument(options) | filePath、userName、mode、webOptions、enableTrackChanges；明确 iOS 来源 URL 权限处理 |
| executeUnoCommand(command,args?,force?) | 通用 Writer 命令桥与 requestId；每条命令的可用性按引擎实际能力，不宣称所有 UNO 均支持 |
| insertText / replaceText | 插入及替换，保留字符样式、修订作者语义 |
| saveDocument / closeDocument | 显式保存、保存后返回，使用会话关联的完成事件 |
| onEditorEvent / offEditorEvent | ready、modifiedStatus、saveCompleted、returned、closed、commandDispatched |
| UI 定制 | 复用已支持的 webOptions/配置；只暴露验证过的工具栏、缩放、菜单能力 |

对齐现有签名和事件字段；新增 sessionId、输出 URL 等只能作为向后兼容扩展。UTS 对 ObjC++ 通过 ObjC/Swift 的稳定桥接调用，不能让 UTS 直接依赖裸 C++ 类型。

修订：ready 后、用户可输入前，设置本次会话作者并明确启用/禁用记录；最终视图显示状态与记录状态独立设置，不能靠 toggle 猜当前状态。保留来源已有修订；换作者再次打开不能沿用上一次全局姓名。审计 DOCX 的 `w:ins/w:del` 作者与时间，不能仅以 UI 显示姓名验收。

### 6.3 地址与文件权限

| 输入 | 实施要求 |
| --- | --- |
| HTTPS | 下载到沙箱；校验 HTTP 状态、类型/签名、大小、重定向与超时；文档下载与引擎数据下载分开 |
| HTTP | 根据 ATS 与宿主允许的域名处理；默认不关闭全局 ATS，受限时给出明确错误 |
| uni 临时路径、沙箱绝对路径、file:// | 平台转换后验证可读性，复制到 sessions；支持中文、空格、URL 转义 |
| Files/iCloud/文档 Provider | UIDocumentPicker 得到授权 URL，按需 security-scoped access 和 NSFileCoordinator；先落地下载再复制，所有访问成对释放 |
| FTP/FTPS | 独立可选适配器；不能假设 URLSession/uni.downloadFile 支持。先冻结成熟库及 TLS/证书能力，再测试下载；未完成时返回 UNSUPPORTED_SCHEME |
| SFTP | 与 FTP 不同协议；另行实现，否则明确不支持 |
| Android content:// 或其他应用私有路径 | iOS 无法继承 Android 授权，明确拒绝；“有只读权限”必须由 iOS 系统实际授权 |

旧 API 的 `sourceUri` 原件写回能力如需对齐，应额外实现 iOS 授权 URL 的协调写入与成功校验；新三参数入口返回副本，不隐式要求来源可写。不可用来源写回失败覆盖已成功生成副本的事实，事件需区分两个结果。

## 7. 实施目录与环境

工作仓库：`D:\Code\CollaboraUniAppXMavenPoC`。mdy-app 只作接口参考，未经新授权不修改。新文件建议：

```text
sdk/ios/
  README.md
  scripts/preflight.sh
  scripts/build-engine.sh
  scripts/build-xcframework.sh
  scripts/package-data.py
  ResourcePolicy.json
  CollaboraEngineBridge/              # ObjC++/Swift 桥，SDK target
  CollaboraRuntimeManager/            # 下载、验签、安装、资源定位
  patches/                           # 固定上游基线的最小补丁
docs/ios/
  baseline-0.1.14.json
  resource-inventory.csv
  acceptance-matrix.md
  size-report.md
uniappx-demo/uni_modules/mac-collabora-editor/utssdk/app-ios/
  index.uts
  config.json
  Info.plist
  Frameworks/                        # 生成依赖；制品下载/还原，不普通 Git 提交
examples/uniapp-ios/                  # 独立普通 uni-app 验证宿主
```

`build/ios/` 存放 XCFramework、ZIP、归档、IPA、日志，沿用根目录 build 忽略规则。源码、补丁、清单格式、构建脚本和使用文档入库；不自动提交/推送。不要复原 app-wps 已删除报告。

必须有 macOS + Xcode + 对应命令行工具、HBuilderX iOS UTS 扩展、签名配置、真机。Windows 可做代码和数据打包辅助；`ssh szy` 若仍是 Linux，只能辅助构建工具，不能替代 Xcode 编译/签名。尚未核实可用 Mac、开发者 Team、iPhone/iPad、证书和描述文件。

上游 iOS 文档要求真机；现有构建的 device arm64 库不能当作 arm64 simulator 库。模拟器支持作为独立工程任务，不作为首版真机验收替代。[上游 iOS 构建文档](https://github.com/CollaboraOnline/online/blob/main/ios/README.md)

Mac 环境初查命令：

```bash
sw_vers
xcodebuild -version
xcode-select -p
xcrun --sdk iphoneos --show-sdk-path
xcrun devicectl list devices
node --version
python3 --version
```

根据固定源码的 `ios/README.md` 安装构建依赖、生成 Engine 的 CPiOS 配置、运行 autogen/configure/make；Node/Python 等版本必须记录，不自动追最新主分支。引擎成功后先在原生最小宿主跑通，再制作 SDK target 与 XCFramework。[Collabora 构建说明](https://raw.githubusercontent.com/CollaboraOnline/CollaboraOnline.github.io/master/content/post/build-code-ios.md)

新 SDK target 创建后再执行（占位名须替换为实际工程/产物）：

```bash
xcodebuild -project sdk/ios/CollaboraEngineBridge.xcodeproj \
  -scheme CollaboraEngineBridge -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/ios/CollaboraEngineBridge.xcarchive \
  SKIP_INSTALL=NO BUILD_LIBRARY_FOR_DISTRIBUTION=YES archive

xcodebuild -create-xcframework \
  -framework build/ios/CollaboraEngineBridge.xcarchive/Products/Library/Frameworks/CollaboraEngineBridge.framework \
  -output build/ios/CollaboraEngineBridge.xcframework
```

上述命令是计划中的新 SDK 工程入口，目前文件尚不存在。若产物为静态 `.a` 则改用 `-library` 与 `-headers`，不能把 `.a` 直接伪装成 framework。所需链接项从上游工程提取，校验符号、重复依赖和资源路径。[Apple XCFramework 制作说明](https://developer.apple.com/documentation/xcode/creating-a-multi-platform-binary-framework-bundle)

通过 UTS `app-ios/Frameworks` 或经过验证的依赖配置集成；`deploymentTarget` 取 Engine、插件、宿主三者需求的最大值，先检测再确定，不照抄网页示例版本。[DCloud iOS UTS 指南](https://uniapp.dcloud.net.cn/plugin/uts-for-ios)

全部本地打包。iOS 原生框架、UTS 编译产物、Info.plist、entitlements 或原生资源声明变化均需要本地重建/安装；兼容的纯数据包变化只走资源更新。HBuilderX 的 Mac 本地 iOS UTS 调试能减少云打包，但不等于原生代码无需编译。[DCloud 本地 UTS 调试](https://uniapp.dcloud.net.cn/tutorial/run/uts-development-ios.html)

## 8. 分阶段执行与验收门槛

### A：冻结基线并确认构建环境

- 核对工作树、0.1.14 实际发布记录和源码补丁；冻结 API/事件清单及测试 DOC/DOCX 原件哈希。
- 只读提取现用插件和三参数入口；处理 PoC 示例 0.1.6 漂移，不能覆盖现用 Android 工程。
- 发现 Mac、Xcode、证书或设备缺失时，给出需要用户提供的最少信息；不把 Linux 编译结果当 iOS 产物。
- 产物：baseline、环境清单、可复现构建命令。未完成前不发布“兼容 0.1.14”的 iOS SDK。

### B：最小原生引擎嵌入

- 先用全随包资源构建 iOS 原生验证宿主；打开、修改、保存、返回同一应用并重开。
- 去除宿主 tmp 清空、应用级退出、全局作者串用和 AppDelegate 侵入。
- 产物：真机运行的 SDK candidate，保存后的 DOCX 与日志。此阶段不追求包体最小，不代表动态资源通过。

### C：动态资源主任务

- 生成 iOS 资源逐项清单；先拆字体/词典等纯数据，再验证 registry/config 外置可行性。
- 实现 ResourceLocator、清单验签、下载校验、解包、原子激活、离线缓存和进度。
- 真机验证首次启动、二次启动无重复下载、断网缓存启动、断点重试、损坏包拒绝、低磁盘、更新中断及与引擎版本不匹配。
- 对每一组迁出资源，运行同一 DOC/DOCX 的打开/保存对照；缺字体不得静默接受排版明显变化。
- 产物：iOS 专用数据 ZIP、签名清单、服务器部署说明、下载量与 IPA 大小实测表。不得上传 Android JNI 包冒充 iOS 包。

### D：完整 API 与双宿主

- 实现 app-ios UTS，与低层 API 表逐项对应；平台文件处理封装到适配层，移除跨平台公共代码中的 Android 强依赖。
- 实现三参数入口、可写副本、模式/作者、保存确认、退出和输出生命周期。
- 同时验证普通 uni-app 与 uni-app x；TS 文件不能不经检查就直接搬进 .uvue/UTS 编译链。
- 普通 uni-app 可保持 TS 入口；uni-app x 采用其支持的入口封装并保持相同调用合同。两端只编译通过不能等于两端功能通过。

### E：验收矩阵与可交付产物

| 用例 | 通过证据 |
| --- | --- |
| 首次下载初始化 | 真实阶段进度、缓存清单、最终打开文档，无白屏 |
| 第二次初始化/重启后离线 | 服务访问记录或网络日志证明未重复下载；文档实际可编辑 |
| 数据包替换 | 不重建 IPA 完成兼容数据更新；原生代码标识不变；会话不被中途切换 |
| 损坏 ZIP/签名/路径越界/版本不匹配 | 被拒绝，活动资源和用户文档未损坏，可重试 |
| 只读输入副本 | 文件 Provider/只读本地来源可编辑副本；原件 SHA-256 不变 |
| 未修改返回 | Promise 返回空串，可再次打开，无失败弹窗 |
| 编辑后保存 | 输入精确到秒的时间戳；退出、重开、解包 DOCX 检查内容都一致 |
| 保存后再编辑 | 最后一次修改也被写入，不因先前 saved 状态提前成功 |
| 撤销至原始状态 | 按最终语义判断未修改，避免仅按 ZIP 字节差异认定修改 |
| review 作者 | 插入、删除修订的作者正确；最终显示状态正确；已有修订保留 |
| review 空作者 | 降级 edit，不产生上一会话作者修订 |
| 上传 | 两种宿主真实调用 uni.uploadFile，服务端下载回来的文件包含编辑内容 |
| .doc 与 .docx | 分别完成打开、模式和保存验证；`.doc` 不能用 DOCX XML 检查替代 |
| 插入/替换/UNO/界面参数 | 每个已公开功能有命令与结果证据；dispatch 不冒充成功 |
| 取消/系统返回/后台/内存警告 | 不白屏、不杀宿主、不泄漏监听；失败保留恢复副本 |
| HTTPS/临时路径/授权 Files URL | 按地址矩阵逐项记录；FTP/FTPS/SFTP 未实现的明确列待办 |

循环打开/返回、内存和冷暖启动耗时记录具体设备、系统、构建号、资源标识与样本数。对功能比对使用当前 0.1.14，不做旧版回归。

最终交付：源码与补丁、SDK XCFramework、iOS 数据 ZIP 及签名清单、本地构建脚本、双宿主示例、函数说明、资源部署文档、验收证据、未验证事项。IPA、资源、符号等通过制品存储交付；签名私钥、证书口令、用户文件不写入文档或普通 Git。

## 9. 后续执行提示词（可直接复制）

> 阅读 `D:\Code\CollaboraUniAppXMavenPoC\docs\IOS_PORT_0.1.14_DYNAMIC_RESOURCES_PLAN.md`，按阶段 A→E 实施 iOS 原生插件移植，重点完成纯数据资源首次下载、校验、安装、缓存和离线复用。先核对当前 Git 工作树、现用 Android 0.1.14 的源码/发布基线和可用 Mac/Xcode/真机环境，不以 PoC 旧 0.1.6 示例作为当前合同。保持同应用离线 Writer 与三参数 Promise 入口；原生引擎随 IPA 签名，不能将下载 Android .so 或 iOS 动态可执行代码当实现路径。所有支持情况按真机证据记录，不夸大 FTP、模拟器、通用 UNO 或免打包能力。优先复用上游 iOS，防止其全局 tmp 清理/退出逻辑破坏宿主。资源前缀从应用端传入，服务器只提供资源文件，不接收文档。需要原生变更时本地构建并递增本次 iOS 验证宿主的版本名称和编号，不云打包；输出 iOS 制品到 build/ios，不覆盖 Android APK。不修改 mdy-app、不自动提交或推送、不覆盖原件；确需用户提供 Mac 连接、签名或真机权限时说明具体缺项。完成后更新使用文档、资源清单、体积实测和验收矩阵。

## 10. 本次文档产出的验证范围

已完成：读取插件接口、现用 TS 入口、file:// 保存补丁、上游 iOS 控制器/文档/项目资源配置；统计本地 Android 资源清单；查阅 Apple、DCloud、Collabora 官方文档。

未完成：iOS 编译、可用 Mac/签名环境确认、任何 iOS 包体积测量、真机功能或资源下载验收、IPA 分发审核。本文所有新目录、SDK target、清单协议和实现步骤均为待执行设计。没有实施原生修改、上传资源或触发打包。
