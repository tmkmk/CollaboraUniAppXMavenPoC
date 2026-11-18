# Collabora Android 运行时资源包

## 当前交付物

- 运行时 ZIP：`collabora-engine-runtime-0.1.4-arm64-v8a-save-return5.zip`
- SHA-256：`2a3ddbf1f3bc22f98191eaa27fd3630c7a7998597e7477dba04a16a1526e1d2e`
- ABI：`arm64-v8a`
- 组成：Writer Web assets、13 个 Engine/NSS `.so`、`runtime-manifest.json`
- Maven AAR：`io.github.tmkmk.collabora:collabora-engine:0.1.14`

## 服务器部署

将 ZIP 原样放到 `https://gjy.gzjtjt.cn/appsource/`，不要解压。客户端由 Vue 端把资源前缀传给 `initializeEngine()`，首次运行下载版本化 ZIP，之后从应用私有目录缓存加载。

下载地址：

```text
https://gjy.gzjtjt.cn/appsource/collabora-engine-runtime-0.1.4-arm64-v8a-save-return5.zip
```

SHA-256 校验文件与 ZIP 一同部署。服务器文件应可通过 HTTPS 直接访问并返回 HTTP 200。

## 生成

从仓库根目录运行：

```powershell
npm install --prefix build/runtime-tooling --no-save --package-lock=false esbuild@0.25.12
python sdk/collabora-engine/package-runtime-resources.py --version 0.1.4 --abi arm64-v8a --archive-name collabora-engine-runtime-0.1.4-arm64-v8a-save-return5.zip --esbuild-module build/runtime-tooling/node_modules/esbuild
```

生成物位于 `build/runtime-resources/0.1.4/`。生成过程需要 Python、Node.js、npm 和 esbuild 0.25.12。`build/` 是本地生成目录，已整体加入 Git 忽略规则；运行时 ZIP 通过服务器或制品存储分发，不提交到 Git。

## 返回与保存处理

运行时包修改了 Collabora Web 资源中的移动端返回和关闭入口。保存成功后，由 Android 原生桥接完成原文件写回并将页面返回 uni-app；UniApp 集成路径不发送 `BYE` 关闭整个 Engine 进程。非 UniApp 的独立 Android 关闭行为保持原样。

设备端行为仍需在目标手机上回归确认，尤其是编辑保存后返回页面以及再次打开文档。
