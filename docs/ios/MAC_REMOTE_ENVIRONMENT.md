# 远端 Mac 开发环境部署记录

日期：2026-11-18。状态：基础工具与独立 SDK 工程 Debug/Release 编译签名已通过；尚未交付可运行的业务基座或 Collabora iOS 引擎。

## 已实测

- 连接：`ssh mac-remote`，用户 `z30`，工作目录 `/Users/z30/collabora-build`。
- Apple Silicon arm64，macOS 26.6.2；Xcode 27.2（27B52），iOS SDK 27.2。
- 已使用管理员权限成功执行 `xcodebuild -runFirstLaunch`。
- 官方 HBuilderX 5.34.2026102909 arm64 安装于 `~/Applications/HBuilderX.app`，`codesign --verify --deep --strict` 通过；CLI 已启动并可响应。
- 自带 `uniapp-uts-v1`、`uts-darwin-arm64.node`、`uniapp-cli-vite`，Node v22.22.2；文件存在不等于已通过项目编译。
- CocoaPods 1.17.0；系统 Python 3.9.6；Homebrew 7.0.5。
- `devicectl list devices` 仅列出关闭的 iPhone 18 Pro 模拟器，没有连接的 iPhone。
- 初始可用磁盘约 73 GiB。尚未复制全量 Engine 源码或发起全量编译，空间预算需单独核算。

## 签名资料

原件仅从 mdy-app 读取，未修改。副本存于远端 `~/collabora-build/signing`，目录权限 0700，文件 0600。

- `XiangDev.mobileprovision`：开发、允许调试，含 3 台设备，2027-09-25 到期。
- `XiangBuild.mobileprovision`：非调试、无设备名单、非企业全设备，属于商店发布用途，不能据此直接向任意手机侧载。
- 两者 Team 为 `8WR2458DLP`，应用标识为 `8WR2458DLP.iso.app.UNIC1D9BB6`。
- 开发、发布 P12 在本地成功解密；Mac 对原格式导入失败，转换兼容 PKCS#12 后成功导入独立 `collabora-build.keychain-db`。
- `security find-identity -v -p codesigning` 对独立钥匙串返回 **2 valid identities**。这尚不等于某一工程已通过签名构建。
- 保留原默认钥匙串，构建钥匙串加入原搜索列表；解锁超时 6 小时。钥匙串密码随机生成，仅存远端权限受限文件。
- 本机管理员/P12凭据位于用户目录 `.collabora-build/mac-remote.credentials.json`，未放入仓库。脚本从标准输入读取 P12 密码。

## 使用方式

将 `sdk/ios/scripts/build-env.sh` 复制至远端工作目录，然后执行：

```bash
source ~/collabora-build/build-env.sh
"$HBUILDERX_CLI" version
xcodebuild -version
pod --version
python3 ~/collabora-build/inspect-profiles.py ~/collabora-build/signing
```

`setup-signing.py` 是签名初始化脚本；需要时从安全凭据来源通过标准输入传入密码，禁止把明文命令或密钥提交仓库。转换临时 PEM 在权限受限临时目录内，操作后自动删除。

## 尚未完成，禁止宣称可打包

1. SDK 已下载至 `~/Downloads/SDK`，原件保留。用户已确认下载为目标正式版，并授权修正标注；副本 `uniapp.podspec` 已从 5.33.0 改为 5.34.0，`pod install --no-repo-update` 退出码 0。仅修正元数据，未改写/升级 SDK 二进制；原标注备份在副本旁。
2. 工具安装已完成，`bootstrap-tools-complete` 存在，日志确认 Python 依赖导入成功。版本：autoconf 2.73、automake 1.20、libtool 2.6.2、pkgconf 3.0.11、cmake 4.5.0、ninja 1.13.2、ccache 4.14.3、gperf 3.3、nasm 3.02、gettext 1.0、wget 1.25.0_2、Python 3.12.16；venv 安装 polib/lxml/cryptography。日志 `logs/finish-bootstrap.log`，不要重复安装。
3. HBuilder CLI 的 `installPlugin --name compile-uniapp` / `uniapp-cli-vite` 返回安装失败；标准安装包本身已含编译模块。不得将这两次失败解释为编译环境已验证，需通过实际 iOS 项目编译确认所缺扩展。
4. 核对业务 iOS Bundle ID、DCloud AppID 与 **iOS AppKey** 对应关系；不能套用 Android AppKey，不能擅自改成另一个业务应用身份。
5. 核对目标 iPhone 是否包含在开发 profile 的 3 台设备内；未连接设备无法完成核对。
6. 尚未执行业务 uni-app 原生资源导出、实际 UTS iOS 插件编译、业务自定义基座安装、DOCX 编辑保存验证；独立 SDK 工程验证见下节，不等于这些步骤通过。
7. Collabora 原生源码版本、Node 版本约束及编译磁盘预算按照 `../IOS_PORT_0.1.14_DYNAMIC_RESOURCES_PLAN.md` 继续核对；不要因为 HBuilder 自带 Node 22 就认为它适用于上游 Engine 构建。

## 后续顺序

先 SDK 与签名基座闭环，再移植 iOS 插件。全部本地构建，不调用云打包。开发/正式包分离签名配置；开发包打开调试资源同步，正式包禁用。iOS 引擎原生代码随 IPA 签名，动态资源方案仅对经核验可外置的数据资源实施。现有 Android 0.1.14 与原件不变。

## SDK 本地编译与签名证据

- `prepare-sdk-host.py` 将下载目录复制到 `~/collabora-build/ios-sdk-host`，只修改副本。为环境验证选择 Core/File/XMLHttpRequest/Zip/Log，本地 Pod 安装成功；不表示业务模块已完整集成。
- `configure-host-signing.rb` 通过 CocoaPods 自带 xcodeproj 配置 HBuilder target，清理示例厂商遗留的条件化 signing 设置，Debug 使用 Xiang，Release 使用 XiangBuild。仅作用于验证工程，不修改 mdy-app。
- `build-sdk-host.py` 在每次构建前显式解锁独立钥匙串，解决 SSH 下 `errSecInternalComponent`，不禁用签名验证。
- 未签名构建：`logs/sdk-host-build.log`，`BUILD SUCCEEDED`。
- 开发签名：`logs/sdk-host-signed-Debug.log`，退出码 0。
- 发布签名：`logs/sdk-host-signed-Release.log`，退出码 0。
- Debug、Release `.app` 均执行 `codesign --verify --deep --strict`，退出码均为 0。完成后磁盘可用约 55 GiB；全量 Engine 构建前必须重新评估空间。
- 产物：`~/collabora-build/DerivedData/Build/Products/{Debug,Release}-iphoneos/HBuilder.app`。**仅用于构建工具/证书验证，仍含示例资源与 AppKey 占位符，不应交给用户当成业务测试基座安装。未导出正式 IPA、未上传商店。**

复用命令（首次副本已存在时不要重复运行 prepare）：

```bash
export GEM_HOME=/opt/homebrew/opt/cocoapods/libexec
/opt/homebrew/opt/ruby/bin/ruby ~/collabora-build/configure-host-signing.rb
python3 ~/collabora-build/build-sdk-host.py Debug
python3 ~/collabora-build/build-sdk-host.py Release
```

用户已提供为上述应用配置的 iOS AppKey，已通过 `configure-sdk-metadata.py` 写入独立副本 Info.plist。完整环境参数与凭据包位于本机 `C:\Users\macxi\.collabora-build`，详见该目录 README.md；仓库中不复制密码和私钥。管理员密码、P12 密码、钥匙串密码及 AppKey 均可从受限 JSON 读取。

当前副本仍是示例前端资源，control.xml 的旧 AppID 尚未与业务资源一起替换，不能作为业务基座交付。后续应导出真实业务资源并同步 AppID、图标、版本和调试开关；真机验收时再连接受开发描述文件覆盖的 iPhone，完成信任/开发者模式授权。本轮元数据修改后已同步 Pod；未重新构建或运行验证 AppKey 的服务端匹配性。
