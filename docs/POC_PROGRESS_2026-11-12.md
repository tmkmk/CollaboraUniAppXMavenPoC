# PoC 进度更新（2026-11-12）

## 已完成

- API JAR 坐标为 `com.company.collabora:collabora-mobile-api:0.1.0-SNAPSHOT`，发布到 PoC SDK 的本地 Maven 仓库。
- JVM Demo 通过 Maven 坐标解析 API JAR，并验证初始化、打开/创建/保存/关闭/销毁调用及 callback。
- Android Demo 已通过本地 Maven 坐标依赖 API JAR 和 Engine AAR，在 Windows 使用 compileSdk 37、minSdk 26 构建；APK 约 430 MB。
- Android Demo 已安装到本机 Android 模拟器（API 32，ABI 列表含 x86_64 和 arm64-v8a）并启动。首次打开因宿主缺少 AppCompat 主题失败，修正主题后通过；随后补充存储权限并重新打开文档。
- 模拟器中 `LOActivity` 已启动、完成 AAR assets 解包；logcat 出现 `coolwsd` 的 `loadDocumentEnd` 和 `firstTileSent`。模拟器界面进入 Collabora 编辑器并显示空白文档页及编辑按钮。API callback 与 Engine 文档打开是 Demo 中两个独立验证点。
- 远端 Linux Engine 构建已成功，目标 ABI 为 `arm64-v8a`。
- 上游 `:lib:assembleDebug` 已成功，产物为 `/opt/collabora-toolchain/src/online/android/build/lib/outputs/aar/lib-debug.aar`，约 152 MB。

## Engine AAR 构建检查

- AAR 含 `classes.jar`、Android Manifest、资源、运行时 assets 和 JNI 库；`liblo-native-code.so` 随 AAR 提供。
- AAR 的 Android Library namespace 为 `org.libreoffice.androidlib`，minSdk 26。上游宿主 App Manifest 显式注册 `org.libreoffice.androidlib.LOActivity`；应由集成宿主声明该 Activity。
- 该构建仅包含 `arm64-v8a` JNI；本机模拟器 ABI 列表包含 `arm64-v8a`，已实际运行引擎。其他不支持 arm64 的设备不能加载此 AAR。
- 上游 AAR 未直接包含 Maven POM 元数据；Demo 本地 POM 已声明 AppCompat、Material、ConstraintLayout 三项传递依赖。
- 单个 AAR 约 152 MB，超过 GitHub 单文件 100 MB 限制，不纳入 Git 仓库；本阶段通过本地 Maven 仓库供 Demo 验证。

## 未完成与限制

- 尚未在 Android 真机验证；模拟器已验证 JNI/Engine 文档加载和首屏 tile 发送，但未验证编辑输入、保存回写及多种文档格式。
- 稳定 API 当前尚未连接上游 `LOActivity` 调用链；API JAR Demo 的代理实现不能视为引擎集成完成。
- 尚未验证 HBuilderX 云端构建和 uni-app x UTS 插件接入。
- GitHub Issue #7 已按 AAR 构建、Maven 接入、模拟器 Engine 文档加载证据关闭。Issue #8 继续跟踪正式 Maven 仓库发布和可复现的依赖元数据。

## 远端构建环境

- `szy` 上 Docker Rocky Linux 9 容器用于原生 Engine 构建；宿主系统未升级。
- 远端已配置 JDK 21、Gradle 9.6、Android SDK 37、NDK 29、CMake 3.22.1 和 Ninja。
- 远端通过本机 Clash Verge 建立的 SSH 反向代理下载构建依赖；重新连接或重启后需确认隧道状态。

## Git 状态

- PoC 仓库当前为 `main`，API JAR、JVM Demo、Android Demo 和本进度文档有未提交改动。
- 本轮不提交、不推送；152 MB AAR 不写入 GitHub 仓库。
