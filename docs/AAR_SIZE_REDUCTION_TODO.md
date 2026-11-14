# 待执行：Engine AAR 专项体积精简

## 当前决策

项目主流程继续使用完整功能 AAR：`org.libreoffice:collabora-engine:0.1.0-poc`，文件大小 158,624,312 字节（约 151.3 MiB）。本地 Maven 文件位于 `sdk/collabora-engine/build/repo/org/libreoffice/collabora-engine/0.1.0-poc/`。

Writer 组件裁剪 AAR 和 `-Oz` 发行构建结果仅供后续专项任务评估，不作为主线最终 AAR，不替换完整坐标或当前 Demo 依赖。正在后台运行的 `collabora-word-size-release2` 可继续完成，但不影响当前完整 AAR。

## 专项任务开始条件

主 PoC 完成当前 Maven、原生 Demo、UTS 接入等验收后，再启动此任务；先确认后台全量构建结束并记录其独立产物和体积。

## 执行内容

1. 以完整 AAR 为基线，记录压缩和未压缩体积、所有 ABI/JNI、资源目录和依赖元数据。
2. 比较资源裁剪、Writer 组件裁剪、`-Oz` 三类候选，产物使用独立 Maven 坐标或目录，完整 AAR 始终保留。
3. 在真实 Android 设备上验证 `.doc`、`.docx` 打开、编辑、保存、重新打开；包含有修订记录的文档。
4. 验证修订显示为最终状态并处于修订模式；检查新修订是否记录用户提供的姓名，而非 `Guest User`。
5. 核对 DOC/DOCX 中表格、图片、嵌入图表和常用格式；出现兼容退化时不晋升候选版。
6. 记录候选 AAR、APK 的体积变化、完整测试证据、兼容限制和 Maven POM，再决定是否将候选版作为后续正式产物。

## 现有候选参考

- 资源裁剪版：142,752,655 字节。
- Writer 组件重链接并裁资源版：133,920,979 字节，当前仅完成 CRC 检查及 Demo 构建/安装，尚未完成功能验收。
- 完整 AAR：158,624,312 字节，继续作为主流程依赖。

## 后台构建

- 远端容器：`collabora-word-size-release2`。
- 查看状态：`ssh szy docker logs --tail 20 collabora-word-size-release2`。
- 构建脚本：`sdk/collabora-engine/build-word-release.sh`。
