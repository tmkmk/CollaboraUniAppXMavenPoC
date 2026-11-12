# PoC 准备报告

生成时间：2026-11-11（Asia/Shanghai）

## 1. 当前范围

README 要求先完成第一阶段环境检查，并生成本报告；正式开发需在报告完成后确认。当前工作目录 `D:\Code\app-wps` 是现有 uni-app 项目，README 指定 PoC 目录 `D:\Code\CollaboraUniAppXMavenPoC` 原先不存在，已按指定路径建立独立 PoC 根目录。未把 PoC 文件写入 `app-wps`，也未恢复其现有删除项 `docs/POC_PREPARATION_REPORT.md`。

## 2. 环境审计

| 项目 | 结果 | 证据/限制 |
|---|---|---|
| Windows | 可用 | Windows 11 amd64 |
| Git | 已安装 | 2.53.0.windows.3 |
| GitHub CLI | 已安装并登录 | `tmkmk`，仓库身份为 `tmkmk/app-wps` |
| Orca | 已安装并运行 | 1.4.256，runtime ready |
| REA | 未发现独立命令 | 不能据此断言 REA 能力已配置 |
| JDK/Javac | 已安装 | Eclipse Temurin 21.0.11 |
| Maven | 已安装 | Apache Maven 3.9.9，`MAVEN_HOME=D:\soft\maven` |
| Gradle | PATH 未配置 | Gradle 9.6.0 wrapper distribution 已存在；离线 Java JAR smoke build 成功 |
| Android SDK | 已安装 | `C:\Users\macxi\AppData\Local\Android\Sdk`；已发现 API 32、API 37、Build Tools 36.0.0 |
| Android Studio | 已安装 | AI-262.10968.63.2622.16840690 |
| ADB | 已安装 | SDK platform-tools 中可执行；当前无连接设备 |
| Android NDK | 未发现 | SDK `ndk` 目录无已安装版本 |
| CMake/Ninja | 未发现 | 不在 PATH，也未发现 SDK 对应目录 |
| HBuilderX | 已安装 | 5.34.2026102909；含 `uts-development-android` 与 uni-app x 工具链 |
| WSL/Linux | 未就绪 | `wsl --status` 未显示可用发行版；不能进行 Linux 原生构建验证 |

## 3. 已验证事项

1. 使用本机 Gradle 9.6.0、JDK 21，在临时 Java Library 工程执行 `gradle --offline jar`，结果为 `BUILD SUCCESSFUL`。
2. HBuilderX 本地知识库记录：Android UTS 插件 `app-android/config.json` 支持 `project.repositories`（HBuilderX 4.36+），可向云端构建工程 `settings.gradle` 的 `dependencyResolutionManagement.repositories` 注入 Maven 仓库；具体配置仍需以正式构建结果验证。
3. HBuilderX 文档同时说明 Android 原生配置需提交云端打包，真机运行应使用自定义基座；因此本机 Maven 解析成功不能等同于云端打包或真机运行成功。
4. Orca 已识别 `tmkmk/app-wps` 工作区，但该仓库不是 README 指定的 Collabora PoC 仓库。

## 4. 缺少环境与处理建议

### 可直接补齐

- 将 Gradle 9.6.0 的 `bin` 加入当前用户 PATH，或在项目中固定 wrapper，避免依赖全局命令。
- 将 Android SDK `platform-tools` 加入当前用户 PATH。

### 需要安装/选择后才能验证

- Android NDK、CMake、Ninja：Engine AAR/JNI 构建必需；版本必须根据 Collabora 实际源码和 Android Gradle Plugin 确定，不能先凭空固定。
- Android 真机（优先 arm64-v8a）：用于 AAR、JNI、DOCX 编辑/保存和离线验证。
- Collabora 官方源码及其原生构建依赖：当前尚未下载，无法据此生成真实 Engine AAR。
- Linux/macOS 原生构建环境：Windows 本机目前没有可用 WSL 发行版；Collabora 上游构建说明可能需要 Linux 工具链。

本轮未自动安装上述大型或版本敏感组件，因为在没有确定 Collabora 源码分支、构建脚本要求和许可证边界前安装会产生不可验证的版本选择。

## 5. P0 实施方案（待确认后执行）

1. 获取并固定 Collabora 官方源码版本，记录来源、提交号和许可证。
2. 根据源码确认可复用 Android Library、JNI、资源、Assets、Manifest 与 ABI，先排除无法独立抽取的完整 App 耦合部分。
3. 创建 `sdk/collabora-api`，实现可独立发布的 Java API JAR，并编写参数、回调、错误处理测试。
4. 创建本地 Maven 仓库，发布 API JAR，建立独立 Android Demo 通过 Maven 坐标下载并调用。
5. 只有 P0 JAR 链路有真实构建证据后，进入 Engine AAR、UTS 插件和真机验证。

## 6. GitHub Issues / Orca 处理

README 建议的 001-019 Issues 不应创建到 `tmkmk/app-wps`，因为当前远程仓库是现有 uni-app 项目，且 PoC 目录尚未成为独立仓库。Orca 当前也没有该 PoC 的 registered repo 或 linked issue。本轮未创建错配 Issues，待确认 PoC 的 Git 仓库归属后再创建并关联。

## 7. 风险与未验证内容

- 尚未验证 Collabora Android 源码能否拆分为 Engine AAR。
- 尚未验证原生 `.so`、ABI、资源和离线文档编辑能力。
- 尚未验证 HBuilderX 本地/云端实际 Maven 依赖解析。
- 尚未验证 Android 真机；当前 ADB 设备列表为空。
- 当前工作区 `D:\Code\app-wps` 保留原状，存在已删除文件 `docs/POC_PREPARATION_REPORT.md`，未提交、未恢复。

## 8. 结论

第一阶段环境审计已完成，基础 Java/Maven/Gradle/JDK 工具链可进行 API JAR P0 开发；Android 原生引擎链路仍缺 NDK、CMake、Ninja、Collabora 源码和真机。正式开发应先确认 PoC 的 Git 仓库归属及 Collabora 源码版本，再开始 P0 API JAR → Maven → 独立 Android Demo 链路。
