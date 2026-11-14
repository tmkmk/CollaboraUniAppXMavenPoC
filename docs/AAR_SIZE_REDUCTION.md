# AAR 体积优化

## 已产出并构建验证的版本

| 产物 | 字节数 | 相对原始 AAR |
|---|---:|---:|
| 原始完整 AAR | 158,624,312 | 基线 |
| 仅资源裁剪 | 142,752,655 | 减少 10.0% |
| Writer 组件重链接并裁资源 | 133,920,979 | 减少 15.6% |

原生库从 353,657,512 降至 325,337,864 字节。通过上游 `native-code.py` 仅注册 `core`、`writer`、`edit` 组，再复用静态库执行 `--gc-sections` 链接和 strip。共享绘图/图表依赖仍可被保留，不能宣称全部 Calc/Draw 代码均已删除。

本地 Maven 坐标：`org.libreoffice:collabora-engine-word:0.1.1-poc`。Android Demo 已通过 Windows Gradle 9.6 离线构建，APK 159,827,412 字节，并已安装到手机。AAR CRC 检查通过。DOCX 打开、编辑、保存及修订模式未完成验证，因此该版本仍是候选产物。

## 继续执行的体积优先构建

`build-word-release.sh` 保存原始配置和二进制后，关闭 dbgutil/debug/symbols，清理生成缓存，使用 `make -j12 gb_COMPILEROPTFLAGS=-Oz` 重编译，再执行 Writer 组件重链接和 AAR 组装。此全量构建截至本记录时仍在运行，尚无最终体积或功能验证结论。

远端容器：`collabora-word-size-release2`。源码挂载为 `/src/online`，工具目录挂载为 `/opt/collabora-toolchain`；必须在 Rocky Linux 构建容器中执行，不应在宿主机复用容器绝对路径配置。

查看进度：`ssh szy docker logs --tail 20 collabora-word-size-release2`。

脚本：

- `sdk/collabora-engine/build-word-release.sh`：发行配置和全量构建。
- `sdk/collabora-engine/relink-word.sh`：Writer 组件静态重链接。
- `sdk/collabora-engine/package-native-word.py`：替换原生库并移除非 Word 发行资源。

纠正上一轮环境记录：Windows 实际已安装 Android SDK 和 Gradle 9.6 缓存。低内存构建参数 `--max-workers=1` 和 JVM `-Xms64m -Xmx256m -XX:MaxMetaspaceSize=192m -XX:ActiveProcessorCount=2 -XX:+UseSerialGC` 已完成本轮 Demo 构建。

所有 AAR/原生库及 APK 位于忽略的 build 目录。未提交、未推送 Git。
