"""Package recompiled Java classes and the save-back WebView bridge into a versioned AAR."""
from __future__ import annotations

import argparse
from io import BytesIO
from copy import copy
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


OLD_SAVE_HANDLER = """            if (event.msgId === 'Action_Save_Resp' && pendingSaves.length > 0) {
                const pending = pendingSaves.shift();
                emit({ type: 'saveCompleted', requestId: pending.requestId, success: event.args.success, result: event.args.result, errorMsg: event.args.errorMsg });
                if (pending.closeAfterSave && event.args.success)
                    window.COOLMessageHandler.closeUniDocument();
            }
"""
NEW_SAVE_HANDLER = """            if (event.msgId === 'Action_Save_Resp') {
                const pending = pendingSaves.length > 0 ? pendingSaves.shift() : { requestId: '', closeAfterSave: false };
                const handler = window.COOLMessageHandler;
                if (handler && handler.onUniEditorSaveResult) {
                    handler.onUniEditorSaveResult(pending.requestId, event.args.success === true, event.args.result || '', event.args.errorMsg || '', pending.closeAfterSave);
                }
                else {
                    emit({ type: 'saveCompleted', requestId: pending.requestId, success: false, errorMsg: 'Native save bridge is unavailable' });
                }
            }
"""
DISPATCH_MARKER = "        window.__uniCollaboraDispatch = (requestJson) => {\n"
SAVE_FOR_EXIT = """        window.__uniCollaboraSaveForExit = () => {
            const requestId = 'native-back-' + Date.now().toString();
            pendingSaves.push({ requestId: requestId, closeAfterSave: true });
            this._map.sendUnoCommand('.uno:Save');
        };
"""


def main() -> None:
    repo = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default="0.1.9")
    parser.add_argument("--base", type=Path, required=True, help="Previously built full AAR")
    parser.add_argument("--classes", type=Path, required=True, help="classes.jar from compileReleaseJavaWithJavac")
    args = parser.parse_args()
    if not args.base.is_file() or not args.classes.is_file():
        raise FileNotFoundError("Base AAR and recompiled classes.jar are required")

    output = repo / "sdk/collabora-engine/build/repo/org/libreoffice/collabora-engine/{0}-poc/collabora-engine-{0}-poc.aar".format(args.version)
    output.parent.mkdir(parents=True, exist_ok=True)
    temp = output.with_suffix(".aar.part")
    with ZipFile(args.base) as source:
        socket_path = "assets/dist/src/app/Socket.js"
        socket_js = None
        if socket_path in source.namelist():
            socket_js = source.read(socket_path).decode("utf-8")
            if OLD_SAVE_HANDLER not in socket_js:
                if "handler.onUniEditorSaveResult" not in socket_js:
                    raise RuntimeError("Could not find the compiled save response bridge in base AAR")
            else:
                socket_js = socket_js.replace(OLD_SAVE_HANDLER, NEW_SAVE_HANDLER, 1)
            if "window.__uniCollaboraSaveForExit" not in socket_js:
                if socket_js.count(DISPATCH_MARKER) != 1:
                    raise RuntimeError("Could not find the compiled dispatch bridge insertion point")
                socket_js = socket_js.replace(DISPATCH_MARKER, SAVE_FOR_EXIT + DISPATCH_MARKER, 1)

        with ZipFile(temp, "w", ZIP_DEFLATED, compresslevel=1, allowZip64=True) as target:
            for item in source.infolist():
                with target.open(copy(item), "w") as destination:
                    if item.filename == "classes.jar":
                        with args.classes.open("rb") as classes:
                            compiled_classes = BytesIO(classes.read())
                        filtered_classes = BytesIO()
                        removed_resource_classes = 0
                        with ZipFile(compiled_classes) as compiled, ZipFile(filtered_classes, "w", ZIP_DEFLATED) as filtered:
                            for class_file in compiled.infolist():
                                if class_file.filename == "org/libreoffice/androidlib/R.class" or class_file.filename.startswith("org/libreoffice/androidlib/R$"):
                                    removed_resource_classes += 1
                                    continue
                                with compiled.open(class_file) as source_class, filtered.open(copy(class_file), "w") as target_class:
                                    while chunk := source_class.read(1024 * 1024):
                                        target_class.write(chunk)
                        if removed_resource_classes == 0:
                            raise RuntimeError("Compiled classes.jar did not contain the expected Android resource R classes")
                        destination.write(filtered_classes.getvalue())
                    elif item.filename == socket_path and socket_js is not None:
                        destination.write(socket_js.encode("utf-8"))
                    else:
                        with source.open(item) as original:
                            while chunk := original.read(1024 * 1024):
                                destination.write(chunk)

    with ZipFile(temp) as artifact:
        with ZipFile(BytesIO(artifact.read("classes.jar"))) as classes:
            if any(name == "org/libreoffice/androidlib/R.class" or name.startswith("org/libreoffice/androidlib/R$") for name in classes.namelist()):
                raise RuntimeError("Packaged classes.jar still contains generated Android resource R classes")
            activity = classes.read("org/libreoffice/androidlib/LOActivity.class")
            required_engine_markers = (
                b"mountUniRuntimeAssets",
                b"onUniEditorSaveResult",
                b"extractUniRuntimeUnpack",
                b"UNI_RUNTIME_ASSETS_EXTRACTED_V2",
                b"getRuntimeAssetUrl",
            )
            if any(marker not in activity for marker in required_engine_markers):
                raise RuntimeError("Compiled classes.jar is missing required runtime asset fixes")
        metadata = artifact.read("META-INF/com/android/build/gradle/aar-metadata.properties").decode("utf-8")
        if "minCompileSdk=36" not in metadata:
            raise RuntimeError("Base AAR must remain compatible with Android 36")
    temp.replace(output)
    print("AAR: {}".format(output))
    print("Bytes: {:,}".format(output.stat().st_size))


if __name__ == "__main__":
    main()
