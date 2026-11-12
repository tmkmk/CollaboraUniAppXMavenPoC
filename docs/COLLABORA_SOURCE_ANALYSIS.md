# Collabora 源码分析

## 固定版本

- 仓库：`https://gerrit.collaboraoffice.com/online`
- 分支：`main`
- 提交：`6c172ae2c9ba34bdde6a773e81449e16a2e28a6e`
- 本地路径：`collabora-source/online`
- 获取方式：匿名只读浅克隆

## 结构证据

- `engine/` 是 LibreOffice/Collabora 核心引擎源码，不是一个可直接作为 Android AAR 的现成模块。
- `android/app` 是完整 Android 应用模块，namespace 为 `org.libreoffice.androidapp`。
- `android/lib` 是 Android Library 模块，namespace 为 `org.libreoffice.androidlib`，包含 JNI/CMake、资源、Assets、Manifest 及 Android 适配代码。
- `android/app` 依赖 `project(':lib')`；完整 App 与 Library 存在明显耦合，不能直接把 APK 当 SDK。
- `android/lib` 使用 `src/main/cpp/CMakeLists.txt`、`jniLibs.srcDirs = ['src/main/cpp/lib']`，并通过 `copyUnpackAssets`、`copyAssets`、`createFullConfig` 等任务生成运行时资源。

## 构建要求

- 官方 Android 构建说明要求 Linux 或 macOS；Windows 不能构建原生部分。
- 当前提交的 Gradle 配置要求 compile/target SDK 37、Build Tools 37.0.0、NDK `29.0.14206865`，CMake `3.22.1+`，minSdk 26。
- 官方说明要求 NDK 27 或更高，当前源码配置具体固定为 29.0.14206865。
- 支持 ABI 由构建配置决定，官方说明列出 armeabi-v7a、arm64-v8a、x86、x86_64；PoC 首先选择 arm64-v8a。

## AAR 抽取结论

### 可以复用的部分

- `android/lib` 是最接近 Engine AAR 的复用边界。
- Library 的 Java/Kotlin Android 适配、JNI 桥接、CMake 输出、`src/main/assets`、`src/main/res` 和 Manifest 资源可作为候选输入。
- `android/lib` 的 API 需要再包一层稳定的 `com.company.collabora` API，不能直接把上游 namespace 当业务接口。

### 与完整 App 强耦合的部分

- `android/app` 的应用入口、Application 配置、品牌资源、分 ABI APK 配置和完整 App 生命周期不能直接纳入业务 UTS 插件。
- `android/lib` 的资源生成依赖先完成 LibreOffice engine 构建并存在 `instdir`、字体、模板、registry/config 等文件。
- JNI 与原生库不是独立少量文件；需要和对应 engine 构建产物、Assets、字体及配置保持版本一致。

### 当前不能确认的内容

- 尚未在 Linux/macOS 完成 engine 构建，因此不能确认最终 `.so` 清单、大小、符号或 ABI 完整性。
- 尚未确认上游 View/Activity 是否可以无修改嵌入 uni-app x 页面；需要 Android 真机和源码调用链验证。
- 尚未确认所有资源是否能压缩或拆分为独立 AAR，不能提前承诺可拆分到更小模块。

## 风险

Windows 本机只能完成源码结构审计和 API 层开发；Engine AAR/JNI/离线 DOCX 运行验证必须迁移到 Linux/macOS 环境，并使用真实构建产物。
