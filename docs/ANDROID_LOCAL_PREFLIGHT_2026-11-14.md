# Android 本地预检（2026-11-14）

## 云打包门槛

云打包由用户操作且产生费用。先完成本地预检和真机打开、编辑、保存检查，再评估是否需要重新云打包。下方续记已完成本地真机 DOCX 验证；完整 uni-app x 自定义基座仍需最终验收，不能用原生验证包替代。

## 已确认的原因和修正

- 手机安装的基座与 `uniappx-demo/unpackage/debug/android_debug_vapor.apk` SHA-256 一致：`111E740F363C6DEA0C47A864BF95C123D662FFCE7081AC41FEE144F37C6E7307`。
- 此 APK 文件时间为 10:38:29，安装时间为 10:53:30；插件主题修改时间为 10:54:35。APK 的最终 Manifest 中 LOActivity 没有 theme。
- 因此此前关于“HBuilderX 丢弃 theme 属性”的结论证据不足，应撤回。现有证据表明运行的 APK 仍是主题修改前的基座。
- 插件 Manifest 已声明 LOActivity，并指定 `Theme.AppCompat.Light.NoActionBar`。
- 项目级补充清单移至 `uniappx-demo/AndroidManifest.xml`。本机 HBuilderX 的 `uniapp-extension/out/index.js` 单独读取项目根目录 AndroidManifest.xml；此前放在 nativeResources/android 下的补充清单已移除。

## 本地构建证据

- 工程：`sdk/android-demo/build/integration-check`（忽略目录）。
- APK：`sdk/android-demo/build/integration-check/build/outputs/apk/debug/collabora-localcheck-debug.apk`。
- 使用插件原始 CollaboraLauncher.kt 和插件 Manifest；引擎坐标为 `io.github.tmkmk.collabora:collabora-engine:0.1.1`，来自本机已发布暂存仓库。
- 验证宿主使用普通 Android Theme.Material.Light.NoActionBar，LOActivity 单独声明 AppCompat 主题。
- SDK 36、Build Tools 36.0.0、AGP 9.3.0、Gradle 9.6.0；AGP 与云端 9.0.1 不同，因此不等同于完整 HBuilderX 云端构建验收。
- assembleDebug 成功，Kotlin/Java 编译、重复类检查、AAR metadata 检查及 Manifest 合并均通过。
- aapt2 从最终 APK 读取到 LOActivity theme 为 `0x7f0f0263`；资源表确认该 ID 为 Theme.AppCompat.Light.NoActionBar，并继承 Theme.AppCompat.Light。
- AAR 含 15 个 arm64-v8a 原生库，已连接手机为 arm64-v8a。

## 首次安装阻塞（已解决）

- 安装独立验证包时手机返回 `INSTALL_FAILED_USER_RESTRICTED: Install canceled by user`。需用户允许 USB 安装后继续，未绕过手机权限。
- 测试文档使用 `/sdcard/Download/collabora-localcheck.docx`，它是 word-size-check.docx 的副本；原文件未修改。
- 安装后通过同一 Kotlin 选择器打开副本，确认引擎加载、文档显示、编辑保存与再次打开。
- 完整 uni-app x 宿主运行仍需最终基座验收；本地验证包不包含 uni-app x 运行时。
- 本轮没有提交新的云打包，没有提交或推送 Git。

## 11:44 真机续验结果

- 用户允许 USB 安装后，本地验证包安装成功。
- 主题修复通过，LOActivity 成功启动，没有再次出现 AppCompat 主题异常。
- 发现并补齐 Android 12L 及以下的 WRITE_EXTERNAL_STORAGE 声明（maxSdkVersion=32）和 INTERNET 声明。Engine 0.1.1 的 LOActivity 在 API < 33 时主动请求 WRITE_EXTERNAL_STORAGE，没有声明则退出；测试通过系统权限对话框正常授权。
- 手机为 Redmi K20 Pro，系统 WebView 为 87.0.4280.141。原 AAR 的 119 个脚本含 class static block，WebView 87 无法解析，导致白屏及后续消息处理错误。
- 使用 esbuild 0.20.1、target=chrome87 转译这 119 个脚本，未修改业务逻辑、Java 类和原生库。兼容资源位于 `uniappx-demo/nativeResources/android/assets/dist`，共 2,031,524 字节；在应用层覆盖同路径 AAR assets。
- 可重复生成：`python sdk/collabora-engine/prepare-webview-assets.py`。输入 AAR、工具版本和输出文件 SHA-256 记录在 `sdk/collabora-engine/webview-compat-assets.json`。升级 AAR 时必须重新评估和生成覆盖文件，不可继续沿用旧版文件。
- 最终本地 APK 中的 119 个覆盖文件与正式项目文件逐个字节一致。Central 坐标仍为 0.1.1，未发布或覆盖该版本。
- 实机通过：文件选择器 -> 打开副本 -> 正文和表格渲染 -> 编辑页眉插入 LOCAL_CHECK_20261114 -> 正常返回保存 -> 强制结束验证进程 -> 重新选择并打开同一文档。
- 从手机拉取保存后的 DOCX，在 word/header2.xml 和 word/header3.xml 找到测试标记；重启后截图也可见标记。
- 副本保存前 SHA-256：`c281cbabe888bcbe712f74024f0dee8afb54d51442d8e8ecda2253c0c21f6885`。
- 副本保存后 SHA-256：`48efafa1f2472d2181151f3a81e610b22ce09a1baa91a7cf66a7a7a7e5a17e11`。
- 原始 word-size-check.docx 再次拉取后与测试前逐字节一致，未改动。
- 证据在本地验证工程目录：compat-opened.png、edited.png、reopened.png、before.docx、after.docx、reopen-logcat.log。重启打开的日志没有 FATAL、Uncaught、TypeError、ReferenceError、SyntaxError。

## 下一次自定义基座验收

1. 使用当前 `uniappx-demo`，包含根目录 AndroidManifest.xml、插件 Manifest 和 nativeResources/android/assets；不能只热更新页面。
2. 由用户生成新的自定义基座，保留下载 APK。安装前检查最终 Manifest 中 LOActivity 的 theme，检查兼容脚本存在，再确认手机安装 APK 哈希与新下载 APK 一致。
3. 本地验证已覆盖当前手机的启动、DOCX 编辑、保存和重开；未覆盖完整 uni-app x 运行时、所有 Android/WebView 版本、DOC 格式和修订功能。
4. 不因上述局部通过而承诺所有设备或云端构建必然无误。本轮未提交云打包，也未产生云打包费用。

## 退出后白屏定位与修复

- 现场 dumpsys 确认白屏处于独立验证包 io.github.tmkmk.collabora.localcheck/.MainActivity。该入口此前只自动启动选择器，没有 setContentView；编辑器退出后返回空 Activity。
- 修改本地验证工程 src/main/java/io/github/tmkmk/collabora/localcheck/MainActivity.java，增加标题、说明和“选择 Word 文档”按钮，改为按钮启动选择器。该工程位于 sdk/android-demo/build/integration-check，为本地构建目录。
- 离线 assembleDebug 成功，覆盖安装成功。真机验证：按钮打开选择器 -> 打开 collabora-localcheck.docx 并正常渲染 -> 返回并等待退出完成 -> 主页面标题和按钮可见；再次点击能进入选择器，取消后仍回到主页面。
- 本轮未改正式 uni-app 插件或引擎保存逻辑，无需额外配置，没有云打包。此次退出白屏根因只在独立验证包；完整 uni-app x 宿主返回仍需其实际基座验收。

## 12:08 打包前最终检查

结论：当前项目可进入一次新的 Android arm64 自定义基座云打包。已知的 SDK 版本、Activity 注册、AppCompat 主题、旧系统权限及 WebView 87 脚本语法问题均有本地验证依据。该结论是打包就绪，不是已完成云端 APK 的真机验收。

- HBuilderX 5.34.2026102909 执行 `cli publish app-android --type appResource --project D:\Code\CollaboraUniAppXMavenPoC\uniappx-demo`，12:03:41 编译与导出成功。导出路径为 uniappx-demo/unpackage/resources/app-android。
- 导出的插件 Manifest、CollaboraLauncher.kt 与源文件逐字节一致；config.json 保留全部源配置，仅自动增加 utsMethodRegister。生成的 index.kt 正确调用 UTSAndroid.getUniActivity 和 CollaboraLauncher.open。
- 首页有实际按钮和内容；App.uvue 无退出时清空页面逻辑。选择器启动编辑器后只关闭自身，未关闭宿主 Activity。本地验证包原白屏来自无布局的入口，不应套用为 uni-app 页面故障。
- 直接读取 Maven Central 0.1.1 POM 与 AAR SHA256，服务可访问；哈希为 5300522f751e8814fab51cc458e74cd3b4919b6f078cd8254697f211fc3899ff，与本地 AAR 一致。元数据 minCompileSdk=36；含15个 arm64-v8a 原生库。
- 119 个应用层覆盖脚本逐个 SHA256 符合 webview-compat-assets.json，并与此前真机验证 APK 内容一致。
- DCloud 官方文档及本机 HBuilderX 打包代码确认：根 AndroidManifest.xml 与 nativeResources/android 为云打包输入。appResource 导出不是完整云打包输入归档，不能只将其当成整个项目上传。
- 本地验证工程 AGP 从9.3.0调整到与用户云日志相同的9.0.1，compileSdk36，执行 assembleDebug 成功（36项任务，1m54s）。Gradle仍为9.6.0，非完整复现云环境。通过 Kotlin/Java、AAR metadata、重复类、资源、Manifest 和 APK 打包检查。
- 本次 AGP9.0.1 APK 已覆盖安装手机，通过同一选择器打开测试副本文档，标题、表格和正文正常；返回后主页面与按钮可见。进程日志未匹配 FATAL EXCEPTION、Uncaught、ReferenceError、SyntaxError、TypeError。证据：本地验证目录 preflight-agp901.png、agp901-logcat.log。
- 单独执行 HBuilderX compile app-android --uni_module 时提示准备安装 uts Android 运行扩展，未得到该命令编译成功结果，不能把退出码0视为通过。上述 HBuilderX appResource 成功和原生 Gradle 构建成功是独立有效证据。
- 本轮未修改正式业务代码、未发布 Central、未提交或推送 Git、未提交云打包。

用户打包操作：使用当前完整 uniappx-demo 项目、HBuilderX5.34、Android自定义基座、arm64-v8a，保留 Maven0.1.1及nativeResources目录。生成后使用新下载基座，不能仅热更新或继续运行旧基座。首次安装需正常授予引擎申请的文件权限。下载APK后检查最终Manifest与119个assets再进行完整uni-app宿主编辑/保存/返回验收。

官方参考：https://doc.dcloud.net.cn/uni-app-x/collocation/app-nativeresource-android.html

## 12:36 官方文档复查与真实 uni-app 宿主验收

本节更新此前“未覆盖完整 uni-app 运行时”的结论：已使用官方 5.34.2026102909 Vapor 离线 SDK，集成当前 HBuilderX 导出的页面字节码、UTS Kotlin 桥、自动注册插件以及 Central Engine 0.1.1，在当前 Redmi 手机上验证真实 uni-app 首页、编辑和返回链路。离线测试不等于云端最终 APK 已验收，但已覆盖原本缺少的真实宿主运行时。

### 官方文档核对

- UTS 原生配置：https://doc.dcloud.net.cn/uni-app-x/plugin/uts-for-android.html
- Android 清单与资源：https://doc.dcloud.net.cn/uni-app-x/collocation/app-nativeresource-android.html
- 手动模块配置：https://doc.dcloud.net.cn/uni-app-x/collocation/manifest-modules.html
- 离线 SDK：https://doc.dcloud.net.cn/uni-app-x/native/download/android.html
- 离线原生工程与 UTS：https://doc.dcloud.net.cn/uni-app-x/native/use/android.html 、 https://doc.dcloud.net.cn/uni-app-x/native/use/androiduts.html
- 文档中限制修改 theme/launchMode 的上下文是 uni-app 页面 Activity；正式项目只为独立 LOActivity 配置主题，没有修改 uni-app 页面 Activity。
- 云端默认压缩原生 so，与验证工程 useLegacyPackaging=true 一致。旧云 APK 的 libc++_shared.so 与 Engine AAR 逐字节哈希一致。

### 新增修复

- 正式项目只修改 uniappx-demo/manifest.json：在 app-android.distribute.modules 显式添加 uni-network、uni-getNetworkType。
- 原因：当前编译产物启用了 uni统计2.0，真实离线宿主日志出现这两个模块不存在；原导出清单只含 uni-storage/uni-form。显式配置后，HBuilderX 导出清单已包含全部四项，离线工程同步包含对应官方 AAR，最终运行日志不再出现模块不存在。
- 不改变编辑器接口、文档格式、修订逻辑或保存行为；需新基座生效，无额外账号配置。

### 本机和手机验证

- 官方 SDK 下载完整大小231397888字节，ZIP CRC检查通过。中断后断点续传，没有重复下载。
- 官方 SDK 集成工程：sdk/android-demo/build/uniapp-preflight/project。独立包名 io.github.tmkmk.collabora.unipreflight，不覆盖原云基座。
- 使用AGP9.0.1、compileSdk36、Gradle9.6.0，包含真实UniApplication、UniAppActivity、Vapor运行时、UTS自动注册。
- 首轮 packageDebug 曾失败但未提供底层异常；未改代码附加stacktrace重跑成功，无法确定首轮原因，不归因为业务错误。补齐网络模块后再次构建成功，耗时33秒。
- HBuilderX在12:32:12再次编译和导出成功；最终导出模块为uni-network、uni-getNetworkType、uni-storage、uni-form。
- 最终APK SHA256：c89c7af155ea8eb639dd86f7871d9c0e5da15f906a038ba13ce34a0f468d837c。119个覆盖assets逐个匹配已记录哈希。
- 真机：冷启动真实uni-app首页 -> 点击选择Word文档 -> 原生文件选择器 -> LOActivity显示DOCX -> 编辑测试副本页眉插入 UNIAPP_PREFLIGHT_20261114 -> 返回保存 -> 恢复真实uni-app首页 -> 再次点击按钮打开选择器 -> 取消返回。
- 从手机拉回副本，在word/header2.xml及word/header3.xml读到新标记；after.docx SHA256为daa50b4a579b1530d58bb0f6a3b45947d48c247014d822e5a8aae187e19442cd。本次使用collabora-localcheck.docx副本，未编辑原始word-size-check.docx。
- 最终进程日志未匹配FATAL EXCEPTION、模块不存在、UnsatisfiedLinkError、NoClassDefFoundError、ActivityNotFoundException、Uncaught、ReferenceError、SyntaxError、TypeError。
- 证据保存在uniapp-preflight目录：build-final.log、home-final.png、editor-final.png、edited-final.png、returned-final.png、before.docx、after.docx、runtime-final.log、source-hashes.json。

结论：可以使用当前完整uniappx-demo项目、HBuilderX5.34重新打Android arm64-v8a自定义基座。新云APK下载后仍应核对Manifest和assets，确认安装的是新包。此次没有提交云打包、没有产生云打包费用、没有提交或推送Git。尚未扩展验收所有设备、DOC格式和修订全场景，不作此类保证。

## 云基座保存失败补查

- 现场云基座包名 io.github.tmkmk.collabora.poc。13:29:27 的日志显示 .uno:Save success=true 后，LOActivity 回写时报 `exception: Media is read-only`。
- 选择器返回 content://com.android.providers.media.documents/document/document:12580。引擎成功写入临时文件不等于原 URI 写入成功；此前可写存储入口的验收未覆盖媒体库只读入口。
- 修改插件 CollaboraLauncher.kt：进入编辑前用 openFileDescriptor(uri, "rw") 打开并立即关闭，不写入或截断文件；失败时明确提示重新从手机存储目录选择，不进入编辑器。增加选择器读写授权请求；Activity 重建时不重复启动选择器。
- 当前云基座可先从左侧手机存储进入 Download 目录选文件，避开只读媒体库分类。新增原生防护需未来更新基座，本轮没有触发云打包。
- 云基座 run-as 被设备拒绝，未读取私有缓存，无法确认恢复此前修改。没有更改用户文档。
- 官方依据：https://developer.android.com/reference/android/provider/DocumentsContract.Document 。URI 授权和实际可写能力是两回事，运行中权限变化仍可能导致回写失败。本次入口防护不等于已经解决所有保存异常。