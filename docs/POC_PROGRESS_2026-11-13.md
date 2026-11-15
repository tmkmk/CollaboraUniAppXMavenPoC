# PoC 进度更新（2026-11-13）

## 2026-11-15 发版续记

- `io.github.tmkmk.collabora:collabora-engine:0.1.6` 已发布到 Maven Central，Sonatype 状态为 `PUBLISHED`；POM、AAR 与签名文件均可公开访问。
- AAR 大小为 5,298,138 字节，SHA-256 为 `0AD13F42CAB1F95D90E0FA6D544B13656DABA8208771D4E73402EF4FCE8DCBC7`；元数据 `minCompileSdk=36`，包含 `libc++_shared.so`。
- 隔离 Android 测试壳已用该 AAR 打开真实 DOCX 并渲染 Writer 页面。该结果不等同于 uni-app 集成验收。
- PoC 与 `mdy-app` 插件配置均已切到 0.1.6。此前 uni-app 自定义基座仍加载 0.1.5 并报 `file:///android_asset/dist/cool.html` 的 `ERR_FILE_NOT_FOUND`；需重新生成并安装自定义基座，后续再验收 uni-app 打开、编辑、原文件写回和返回复用。

## Word-only 精简

- Android Demo 只接受 `.doc`、`.docx`，只依赖 Engine AAR；移除了未使用的 API JAR 依赖、ODT 测试文件和未接入的修订桥接类。
- 新增本地 Maven 坐标 `org.libreoffice:collabora-engine-word:0.1.0-poc`。从完整 AAR 删除 Gallery、视频背景、演示/电子表格模板资源后，产物为 142,752,655 字节，较原始 158,624,312 字节减少 15,871,657 字节（约 10.0%）。压缩包流式复制会引入少量 ZIP64 头开销。
- AAR 共 6,589 个条目；保留 arm64 `liblo-native-code.so` 和 DOCX 模板。压缩后的 `.so` 为 108,384,055 字节，是当前主要体积来源。完整 AAR 和完整 Maven 坐标未覆盖。
- 可复现资源过滤脚本：`sdk/collabora-engine/trim_word_aar.py`。上游 Gradle 资源过滤补丁：`sdk/collabora-engine/word-only-assets.patch`，可用 `-PwordOnly=true` 开启。
- Demo 启用 JNI legacy packaging，以压缩 APK 中的 `.so`；安装运行时仍需解压。此设置未在本轮设备上重新验证。

## 原生库裁剪评估

- 本轮没有重新编译或缩小 `liblo-native-code.so`。当前归档 AAR 含完整原生引擎；移除 Calc/Impress 模块需调整 LibreOffice 模块依赖图，可能影响 Writer 共享的绘图、图表、导入导出和修订能力。
- 上游 Gradle AAR 重新构建未完成。远端构建源码是 archive 快照，CMake 缓存引用 `/src/online` 空目录。补建源码目录链接后，wrapper C++ 开始编译，但继续遇到缺少 `config_version.h`、`test/testlog.hpp` 等生成配置/测试头文件。需完整重新运行上游 configure/autogen 并整理源码布局，不能通过当前增量缓存安全完成。

## 验证状态

- AAR 检查通过：DOCX 模板和 arm64 原生引擎存在；图库、视频和演示/表格模板目录不存在；Maven POM XML 有效。
- Android Demo 本轮未重新构建；本机未检测到 Gradle/Android SDK。远端 `:lib:assembleDebug` 被上游 CMake 源目录和生成头文件问题阻断。
- 精简 AAR 尚未在 Android 设备上验证打开、编辑、保存及修订默认状态。现有功能验证只针对先前完整 AAR。
- 工作区未提交、未推送；AAR 二进制不加入 Git。

## 后续续记：恢复完整 AAR 主线

- 主流程指定使用完整功能 AAR `org.libreoffice:collabora-engine:0.1.0-poc`（158,624,312 字节）。Writer 裁剪版仅作为专项候选，不替换主线依赖；后续执行要求见 `docs/AAR_SIZE_REDUCTION_TODO.md`。
- Android Demo 同时通过本地 Maven 引用 API JAR 和完整 Engine AAR。Engine POM 已增加 API JAR 传递依赖；`debugRuntimeClasspath` 离线依赖解析成功。
- 完整 AAR 对应 Android Demo 构建成功，APK 为 283,773,089 字节，已安装到已连接手机。该次安装确认应用可启动到文件选择界面；尚未据此宣称完整 DOCX 编辑、保存和修订姓名验收通过。
- `-Oz` Writer 裁剪全量构建继续在独立容器 `collabora-word-size-release2` 后台运行，尚无最终 AAR 体积；不影响完整 AAR 主线。

## 后续续记：开始 uni-app x UTS 集成

- 新建 `uniappx-demo/` 最小 uni-app x Demo 和 `mac-collabora-editor` UTS 插件。页面调用插件后，由 Kotlin 原生辅助类启动系统文件选择器，只接受 DOC/DOCX 的常见 MIME 类型/扩展名，再显式启动完整 AAR 的 `org.libreoffice.androidlib.LOActivity`。
- 插件通过 Maven 坐标 `org.libreoffice:collabora-engine:0.1.0-poc` 引入完整 AAR；POM 传递引入 API JAR。插件目录不含 JAR、AAR、SO。当前仓库 URL 指向 PoC 工作区中的本地 Maven 仓库，仅适用于本机打包验证；云端打包需要可访问的远程 Maven 仓库，尚未发布。
- 已核验 HBuilderX 5.34+ 官方 UTS Android `config.json` 字段，支持 `dependencies`、`abis`、`minSdkVersion` 和 `project.repositories`。原生配置变化需要云端打包后生成自定义基座才能在设备上生效；当前没有以 HBuilderX 构建此 UTS Demo。
- 校验：插件 `config.json` 可解析；HBuilderX 5.34 自带 UTS 编译器已将入口生成 Kotlin；Kotlin 辅助代码通过 Android 37 `android.jar` 编译。Standalone UTS 依赖检查未通过：临时 Gradle 工程未应用插件自定义仓库，报 `Could not find org.libreoffice:collabora-engine:0.1.0-poc`，并提示项目级 repositories 与 centralized settings 冲突。尚未用 HBuilderX 官方自定义基座/云端流程构建，也未用 UTS 页面选取文件、打开/保存文档。Android 原生 Demo 已安装到 Redmi，但它不构成 UTS 集成验收。
- 为适配 HBuilderX 检查器安装了官方 Gradle 8.14.3 到用户 `.gradle` 缓存，SHA-256 校验通过；未改全局 PATH。Gradle Daemon 曾因 Windows 可提交虚拟内存不足启动失败；限堆后可运行至 UTS Maven 依赖检查。
- 当前入口是完整 Activity 跳转，不是页面内嵌 View；API JAR 的抽象 `CollaboraEditor` 接口尚未接入这条上游 Activity 调用链；修订最终显示状态、默认修订模式及修订人员姓名尚未验收。
- 后台 `collabora-word-size-release2` 容器仍为 running，日志停留在 gbuild 依赖文件生成阶段，内层 make 进程 CPU 使用率接近空闲；未产出新 AAR，不纳入当前主线验收。

## 后续续记：动态运行资源与原文件写回（2026-11-15）

- `mac-collabora-editor` UTS 已增加 `initializeEngine(resourceBaseUrl)`。Vue 传入 HTTPS 前缀；插件下载并缓存 `collabora-engine-runtime-0.1.4-arm64-v8a.zip`，核验文件清单和 JNI SHA-256，提取并加载 13 个 JNI 资源。插件未硬编码资源站点。
- 本机 HBuilderX 5.34 编译通过，应用运行于 `emulator-5554`。模拟器成功下载 154,480,011 字节 ZIP、解出资源并加载 `liblo-native-code.so`，随后进入系统文件选择器。模拟器系统为 x86_64，当前 `arm64-v8a` 加载依赖其 Native Bridge；正式支持范围仍按 `arm64-v8a` 说明。
- Engine `apply-save-back.py` 增加可复现修改：等到 Engine `Action_Save_Resp` 后再通过 `ContentResolver` 写回传入的 SAF URI；比对写入字节数及 SHA-256，失败时保留编辑器并上报失败。文件绝对路径走 Engine 原位保存。编辑器左上返回和系统返回保存后把 uni-app Activity 调到前台、保留当前编辑器 Activity；重开相同文档复用实例。
- 复核后移除了“最近一次保存 5 秒内成功即可略过关闭保存”的逻辑，并增加退出保存状态防止快速重复关闭触发并发保存。
- 远端 Gradle 9.5/JDK 17 的 `:lib:compileReleaseJavaWithJavac` 成功。由完整 0.1.4 AAR 换入修订后的 classes.jar 和 Web Socket 保存桥，再移除 6,556 个可动态加载的 assets 条目及 13 个 JNI 库；保留 `LOActivity`、Manifest、布局/主题、许可证和两个核心 JNI 库。0.1.5 候选轻量 AAR 为 4,521,392 bytes，`minCompileSdk=36`。
- 0.1.5 Central bundle 已签名且本地验签通过；Maven Central 返回 `PUBLISHED`，POM、AAR、签名文件公共 URL 均 HTTP 200。
- 当前模拟器基座仍解析 0.1.4，因此仅验证了 UTS 初始化和 JNI 动态加载。新 AAR 的 ZIP AssetManager 挂载、编辑后 SAF 原件回写、快速返回后再编辑并保存、Activity 复用均尚未设备验收；未触发 HBuilderX 云打包。
- 下一步：由 HBuilderX 生成/安装包含 0.1.5 依赖的自定义基座，再用副本 DOCX 做修改、保存哈希、返回 Vue、重开与失败写回场景验收。

## 后续续记：Central Android 36 兼容版与 HBuilderX 云打包

- 0.1.0 的完整 Engine AAR 在 HBuilderX 云构建中因 `minCompileSdk=37`、应用 compileSdk 36 而失败。
- 上游 Android Library 在 Android 36 下重新执行 Gradle 打包，`:lib:assembleDebug` 成功；更新 AAR 元数据为 `minCompileSdk=36`。本次继续使用此前全功能的浏览器资源和 arm64 native wrapper / Engine 库，未裁剪功能，也未重编译 Engine `.so`。
- 0.1.1 AAR 大小 158,624,312 bytes，与全功能 0.1.0 相同；包内 6713 项、15 个 `arm64-v8a` `.so`、完整 `assets/dist` 和 `assets/unpack` 均已核验。
- 0.1.1 已发布 Central，POM 与 AAR 公共 URL 返回 HTTP 200；GPG 签名本地验证通过。UTS 插件 Maven 坐标已切到 0.1.1。
- HBuilderX CLI 编译成功并成功提交 Android 自定义基座云打包。云端队列拥堵，仍在排队；尚无 APK 下载结果。
- Manifest 使用 uni-app x 的 `app.distribute.android.packagename`。CLI 还需要显式 `--android.packagename io.github.tmkmk.collabora.poc`。
- 当前 ADB 无在线设备；AAR 仅含 arm64-v8a，x86_64 模拟器不能用于运行验收。待自定义基座下载、arm64 手机连接后，继续安装并验证打开/编辑/保存。
- 中央发布脚本现在支持 `-Version`，并支持 `-DeploymentId` 续查已上传部署；暂存目录按版本隔离，避免将 0.1.0 组件误打入 0.1.1 bundle。


## 2026-11-15 K20 Pro 动态资源崩溃修复

- Redmi K20 Pro（`5be5b2d0`）重现：文件选择和 13,931 字节 DOCX 复制成功，运行 ZIP 已挂载；Android `AndroidProtocolHandler` 无法从 `file:///android_asset/...` 打开网页资源，随后 LOKit 报 `cpo::uno::DeploymentException` 并 SIGABRT。
- 根因：`file:///android_asset/` 请求不经过 `WebViewClient.shouldInterceptRequest`；旧 `copyFromAssets()` 失败时也没阻止引擎启动。
- 新增 `sdk/collabora-engine/patch-runtime-assets.py`：UNO 资源改为直接解压并校验 `udkapi.rdb`、`offapi.rdb`、`oovbaapi.rdb`；校验失败则停止启动；WebView 从应用私有目录的解压网页加载。更换缓存键以强制旧安装首次重新提取。
- `:lib:compileReleaseJavaWithJavac` 与 `:lib:bundleLibCompileToJarRelease` 成功；AAR 0.1.8 为 4,597,208 字节。Maven Central 状态为 PUBLISHED；公开 AAR 与本地候选 SHA-256 一致（`595984561ec8e01846293c6c08d1db953c55d6ad87db6da2308ef0d72d0523e4`）。
- 设备端尚未验证 0.1.8；需重新云端打包自定义基座并在 K20 Pro 验收 DOCX 打开、编辑、保存。
