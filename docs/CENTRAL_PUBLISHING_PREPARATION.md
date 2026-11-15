# Maven Central 与自定义基座状态（2026-11-13）
## 0.1.6 发布记录（2026-11-15）

- Maven 坐标：`io.github.tmkmk.collabora:collabora-engine:0.1.6`。
- Sonatype 部署已返回 `PUBLISHED`；公共 POM、AAR 和 AAR 签名 URL 均返回 HTTP 200。
- AAR 大小 5,298,138 bytes，SHA-256：`0ad13f42cab1f95d90e0fa6d544b13656daba8208771d4e73402ef4fce8dcbc7`；与 Central 下载文件一致。
- 修复 `LOActivity` 只将普通 ZIP 挂载到 AssetManager、WebView 无法从 `file:///android_asset/` 读取运行时网页资源的问题：Java 层将 ZIP 内 `assets/` 安全解压到应用私有目录，WebView 请求从该目录读取，并保留内置资源回退。
- 隔离 Android 测试壳已用 0.1.6 AAR、线上运行时 ZIP 和真实 DOCX 完成打开及页面渲染验证。uni-app 当前基座仍为 0.1.5，需重新构建含 0.1.6 的自定义基座后做实际 uni-app 验收。

## 最新发布状态（2026-11-14）

- `io.github.tmkmk.collabora:collabora-engine:0.1.4` 已在 Maven Central 发布，Sonatype 部署 ID：`cd9d80fa-9b0b-41c2-a8e6-92145f8b6b03`，状态 `PUBLISHED`。
- 公网 Maven Central POM 返回 HTTP 200（2,046 bytes），AAR 返回 HTTP 200（158,623,909 bytes）；本地发布候选 AAR SHA-256：`0d598d960820685b3d1295ebcc9badf3d66ca751d50fdab43798c08a20158867`。
- 0.1.4 保留全功能 AAR；UTS 插件已改用直接 UTS/Android API 封装，依赖坐标为 0.1.4。仅修改 UTS 调用层时不必重发 Maven AAR。
- UTS/Android Gradle 集成构建与本地 APK 构建通过；新 0.1.4 自定义基座上的真实 DOC/DOCX 打开、编辑、保存仍需安装并在 arm64 手机验收。云打包未由本轮触发。

## Maven Central 发布

- `io.github.tmkmk.collabora:collabora-engine:0.1.0` 已发布，但其 AAR 元数据要求 `minCompileSdk=37`，与 HBuilderX 云构建使用的 Android 36 不兼容。
- 已重新构建并发布兼容版本 `io.github.tmkmk.collabora:collabora-engine:0.1.1`。
- 0.1.1 AAR 大小为 158,624,312 bytes，包含完整资源和 15 个 `arm64-v8a` 原生库；AAR 内 `META-INF/com/android/build/gradle/aar-metadata.properties` 的 `minCompileSdk=36`。
- 构建使用 Android 36 Platform / Build Tools，Gradle `:lib:assembleDebug` 成功。上游浏览器资源与 `libandroidapp.so` 使用既有全功能构建产物复用，Writer 原生引擎未做裁剪。
- Central 部署 ID：`e05e406d-d12a-415b-a5ef-f9ae22c30502`，状态 `PUBLISHED`。Maven Central POM 与 AAR URL 均返回 HTTP 200。
- GPG detached signatures 已验证通过。用户级 Maven `settings.xml` 含 Central User Token；密钥、token 和口令不写入仓库。

## uni-app x / HBuilderX

- UTS 插件依赖已更新为 0.1.1，仓库使用 Maven Central。
- Android 包名配置为 `io.github.tmkmk.collabora.poc`，位于 uni-app x `app.distribute.android.packagename`。
- HBuilderX CLI 云打包另需显式传入 `--android.packagename io.github.tmkmk.collabora.poc`；仅设置 manifest 字段不足以通过 CLI 参数校验。
- 云打包编译阶段已成功，任务已提交。最近队列提示为第 401 位，预计约 29 分钟后开始打包；请继续使用 `cli pack status` 检查。
- 当前 ADB 没有在线设备；可用 AVD 是 x86_64，而该 AAR 仅包含 arm64-v8a，所以自定义基座完成后仍需连接 arm64 Android 手机进行安装、启动和文档编辑验收。
- HBuilderX 提示安装包大于 100 MB 时可能产生超限费用；提交本身不扣费。若下载页要求确认付费，需要在确认前核实金额。

## 复现脚本

- `sdk/central-release/prepare-bundle.ps1 -SigningKeyId <签名密钥ID> -Version 0.1.1`
- `sdk/central-release/publish-bundle.ps1 -Version 0.1.1 -DeploymentId <部署ID> -TimeoutMinutes 30` 可继续查询已存在的部署，不会重新上传。
- 大小精简版和全量 Engine 重编译仍是独立任务；本次 0.1.1 保留完整 AAR 功能和原始体积。

## 尚未完成

- 云端自定义基座仍在排队，待下载后安装并运行验证。
- 连接 arm64 Android 手机，完成 UTS 页面选择 DOC/DOCX、打开、编辑、保存的真机验收。
