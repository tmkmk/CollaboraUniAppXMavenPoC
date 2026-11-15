# Collabora Android 运行时资源包

## 交付物

- ZIP：`build/runtime-resources/0.1.4/collabora-engine-runtime-0.1.4-arm64-v8a.zip`
- SHA-256：`b5487e952888d0361bf7f3943bc45934596b75408d2155797dfd8bb38fad0863`
- 校验文件：`collabora-engine-runtime-0.1.4-arm64-v8a.zip.sha256`
- 资源逐文件清单：`runtime-manifest.json`（也内嵌在 ZIP 根目录）
- ZIP 大小：154,480,011 字节（约 147.3 MiB）
- 解压后大小：468,523,853 字节（约 446.8 MiB）
- 来源：Maven 制品 `io.github.tmkmk.collabora:collabora-engine:0.1.4`
- ABI：`arm64-v8a`

在 Windows PowerShell 中可验证文件哈希：

```powershell
Get-FileHash .\collabora-engine-runtime-0.1.4-arm64-v8a.zip -Algorithm SHA256
```

## 服务器部署

将 ZIP 原样放到：

```text
https://gjy.gzjtjt.cn/appsource/collabora-engine-runtime-0.1.4-arm64-v8a.zip
```

解压后保留 ZIP 内目录层级，服务器目录应包含：

```text
appsource/
├── assets/
│   ├── dist/
│   ├── program/
│   ├── share/
│   ├── templates/
│   └── unpack/
├── jni/arm64-v8a/
│   ├── libfreebl3.so
│   ├── liblo-native-code.so
│   ├── libnspr4.so
│   ├── libnss3.so
│   ├── libnssckbi.so
│   ├── libnssdbm3.so
│   ├── libnssutil3.so
│   ├── libplc4.so
│   ├── libplds4.so
│   ├── libsmime3.so
│   ├── libsoftokn3.so
│   ├── libsqlite3.so
│   └── libssl3.so
└── runtime-manifest.json
```

下载 URL 前缀应以 `/` 结尾，例如 `https://gjy.gzjtjt.cn/appsource/`。客户端资源加载器需要请求版本化 ZIP 文件名，不能把 ZIP 解压到额外的同名子目录，否则清单中的相对路径会多一层。

## 资源清单

ZIP 含 6,316 个 assets：

| 路径 | 文件数 | 用途 |
|---|---:|---|
| `assets/dist/` | 4,503 | Writer Web 编辑界面、脚本、样式及运行所需 Web 资源 |
| `assets/share/` | 1,746 | 字体配置、过滤器、图形、语言数据、注册表和主题资源 |
| `assets/unpack/` | 53 | 首次启动需落入应用私有目录的 UNO/引擎配置、类型库及字体等 |
| `assets/program/` | 6 | 引导配置与 services 数据 |
| `assets/templates/` | 6 | 内置文档模板 |
| `assets/license.html`、`assets/notice.txt` | 2 | 许可与声明文件 |

另含 13 个 Engine/NSS 运行库 `.so`，完整路径和每个文件的字节数、SHA-256 见 ZIP 内 `runtime-manifest.json`。

## 必须随应用保留的内容

当前 `LOActivity` 实现仍要求应用安装时携带 Android 代码、资源和组件声明。Android 不支持通过下载 ZIP 在运行时注册新的 Activity。因此下面内容没有放入运行时 ZIP：

- `LOActivity` 及其 Java 类、`classes.jar`。
- Android Manifest 中的 `LOActivity` 声明。
- `LOActivity` 使用的 Android 资源、布局和 AppCompat/Material 依赖。
- `libandroidapp.so`：当前 Activity 静态初始化调用 `System.loadLibrary("androidapp")`。
- `libc++_shared.so`：保守地随核心 JNI 库保留，避免动态链接器找不到 C++ 运行库。

这意味着本方案应发布一个移除 `assets/**` 和 13 个外置 Engine/NSS `.so` 的轻量核心 AAR，而不能完全移除所有 AAR/Java 代码。将外置 ZIP 下载并解压还不够：还需在 Java Activity 初始化阶段将 ZIP 中的 `assets/` 挂入 Android `AssetManager`，在创建 Engine 前把本地 `.so` 加载到正确的 linker namespace，并让首次解包逻辑从该 AssetManager 获取资源。

**当前实现状态（2026-11-15）：** `mac-collabora-editor` 从 Vue 函数参数接收资源 URL，下载 ZIP、验证清单、提取并校验 13 个 JNI 库，再调用 `System.load`。轻量 `collabora-engine:0.1.6` AAR 已发布到 Maven Central，大小 5,298,138 bytes，包含安全解压运行时 `assets/` 并拦截 `file:///android_asset/` 请求的 Java 修复；公共 POM、AAR、签名 URL 返回 HTTP 200，公共 AAR SHA-256 与候选产物一致。本机隔离 Android 测试壳已成功打开真实 DOCX 并渲染 Writer 页面。资源 ZIP 保持版本 `0.1.4`，不需要重新上传；uni-app 自定义基座须集成 AAR `0.1.6`，之后再验收 uni-app 入口、原文件保存与返回复用。

## 生成方式

从仓库根目录执行：

```powershell
python sdk/collabora-engine/package-runtime-resources.py --version 0.1.4 --abi arm64-v8a
```

资源文件较大，`build/runtime-resources/` 已加入 `.gitignore`，请通过服务器或制品存储分发，不要提交到 Git。
