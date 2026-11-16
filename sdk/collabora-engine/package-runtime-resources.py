"""Build the versioned runtime resource bundle from the published Engine AAR."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from shutil import copyfileobj
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile, ZipInfo


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
            this._map.save(false, false);
        };
"""
CLOSEAPP_MARKER = """                if (window.codaRemotePage)
                    postUICloseToIntegrator();
                window.postMobileMessage('BYE');
"""
CLOSEAPP_PATCH = """                if (window.codaRemotePage)
                    postUICloseToIntegrator();
                if (window.COOLMessageHandler && window.COOLMessageHandler.closeUniDocument) {
                    window.COOLMessageHandler.closeUniDocument();
                    return;
                }
                window.console.error('Collabora UniApp close bridge is unavailable; keeping the editor engine alive.');
"""
MOBILE_BACK_MARKER = """    enterReadonlyOrClose() {
        if (this.map.isEditMode()) {
            this.map.setPermission('readonly');
"""
MOBILE_BACK_PATCH = """    enterReadonlyOrClose() {
        if (this.map.isEditMode()) {
            if (window.ThisIsAMobileApp && !window.ThisIsTheEmscriptenApp &&
                window.COOLMessageHandler && window.COOLMessageHandler.closeUniDocument) {
                window.COOLMessageHandler.closeUniDocument();
                return;
            }
            if (window.ThisIsAMobileApp && !window.ThisIsTheEmscriptenApp) {
                window.console.error('Collabora UniApp close bridge is unavailable; keeping the editor engine alive.');
                return;
            }
            this.map.setPermission('readonly');
"""
OLD_PASSWORD_GIVEUP = """            else if (window.ThisIsAMobileApp && !window.ThisIsTheEmscriptenApp) {
                window.postMobileMessage('BYE');
            }
"""
NEW_PASSWORD_GIVEUP = """            else if (window.ThisIsAMobileApp && !window.ThisIsTheEmscriptenApp) {
                const handler = window.COOLMessageHandler;
                if (handler && handler.closeUniDocument)
                    handler.closeUniDocument();
                else
                    window.console.error('Collabora UniApp close bridge is unavailable; keeping the editor engine alive.');
            }
"""
OLD_FATAL_CLOSE = """                    window.postMobileMessage('BYE');
                    this._map.uiManager.closeAll();
"""
NEW_FATAL_CLOSE = """                    const handler = window.COOLMessageHandler;
                    if (handler && handler.closeUniDocument)
                        handler.closeUniDocument();
                    else
                        window.console.error('Collabora UniApp close bridge is unavailable; keeping the editor engine alive.');
                    this._map.uiManager.closeAll();
"""
OLD_BROWSER_SETTING_HANDLER = "if (event.data.startsWith('browsersetting:')) {"
NEW_BROWSER_SETTING_HANDLER = "if (typeof event.data === 'string' && event.data.startsWith('browsersetting:')) {"


def prepare_webview_assets(source: ZipFile, node_path: str, esbuild_module: str) -> dict[str, bytes]:
    """Transpile static class blocks for Android WebView 87 and guard binary socket frames."""
    replacements: dict[str, bytes] = {}
    candidates: list[tuple[str, bytes]] = []
    global_path = "assets/dist/global.js"
    for name in source.namelist():
        if not name.startswith("assets/dist/") or not name.endswith(".js"):
            continue
        content = source.read(name)
        if name == global_path:
            text = content.decode("utf-8")
            if OLD_BROWSER_SETTING_HANDLER in text:
                text = text.replace(OLD_BROWSER_SETTING_HANDLER, NEW_BROWSER_SETTING_HANDLER, 1)
            elif NEW_BROWSER_SETTING_HANDLER not in text:
                raise RuntimeError("Could not locate the browser-setting WebSocket handler")
            content = text.encode("utf-8")
            replacements[name] = content
        if b"static {" in content or b"static{" in content:
            candidates.append((name, content))

    if not candidates:
        raise RuntimeError("No JavaScript static class blocks were found to transpile")
    if not node_path:
        raise RuntimeError("Node.js is required; pass --node with the Node.js executable")

    with tempfile.TemporaryDirectory(prefix="collabora-webview-") as temp_name:
        temp_root = Path(temp_name)
        for name, content in candidates:
            target = temp_root.joinpath(*Path(name).parts[2:])
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
        driver = temp_root / "transpile.js"
        driver.write_text(
            "const fs = require('fs');\n"
            "const path = require('path');\n"
            "const esbuild = require(process.argv[2]);\n"
            "const root = process.argv[3];\n"
            "function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {\n"
            "  const file = path.join(dir, entry.name);\n"
            "  if (entry.isDirectory()) walk(file);\n"
            "  else if (file.endsWith('.js') && file !== __filename) {\n"
            "    const source = fs.readFileSync(file, 'utf8');\n"
            "    const result = esbuild.transformSync(source, { loader: 'js', target: 'chrome87', legalComments: 'inline' });\n"
            "    fs.writeFileSync(file, result.code);\n"
            "  }\n"
            "} }\n"
            "walk(root);\n",
            encoding="utf-8",
        )
        result = subprocess.run(
            [node_path, str(driver), esbuild_module, str(temp_root)],
            check=False,
            capture_output=True,
            text=True,
            env=os.environ.copy(),
        )
        if result.returncode != 0:
            raise RuntimeError("WebView asset transpilation failed: {}".format(result.stderr.strip()))
        for name, _ in candidates:
            transformed = temp_root.joinpath(*Path(name).parts[2:]).read_bytes()
            if b"static {" in transformed or b"static{" in transformed:
                raise RuntimeError("Unsupported class static block remains in {}".format(name))
            replacements[name] = transformed
    return replacements


def sha256_stream(source) -> tuple[str, int]:
    digest = hashlib.sha256()
    size = 0
    while chunk := source.read(1024 * 1024):
        digest.update(chunk)
        size += len(chunk)
    return digest.hexdigest(), size


def main() -> None:
    repo = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default="0.1.4")
    parser.add_argument("--abi", default="arm64-v8a")
    parser.add_argument("--archive-name", default=None, help="override the generated ZIP filename")
    parser.add_argument(
        "--include-core-native",
        action="store_true",
        help="include libandroidapp.so and libc++_shared.so (normally remain in the app)",
    )
    parser.add_argument("--node", default=shutil.which("node"), help="Node.js executable used with esbuild")
    parser.add_argument("--esbuild-module", default=os.environ.get("COLLABORA_ESBUILD_MODULE", "esbuild"), help="esbuild module path or resolvable package name")
    args = parser.parse_args()

    aar = repo / "sdk/collabora-engine/build/repo/org/libreoffice/collabora-engine/{0}-poc/collabora-engine-{0}-poc.aar".format(args.version)
    output_dir = repo / "build/runtime-resources" / args.version
    output_dir.mkdir(parents=True, exist_ok=True)
    archive_name = args.archive_name or "collabora-engine-runtime-{0}-{1}.zip".format(args.version, args.abi)
    if Path(archive_name).name != archive_name:
        raise ValueError("--archive-name must be a filename, not a path")
    bundle = output_dir / archive_name
    inventory: list[dict[str, object]] = []
    core_native = {"libandroidapp.so", "libc++_shared.so"}

    if not aar.is_file():
        raise FileNotFoundError("Engine AAR not found: {}".format(aar))

    with ZipFile(aar) as source, ZipFile(bundle, "w", ZIP_DEFLATED, compresslevel=6, allowZip64=True) as target:
        socket_path = "assets/dist/src/app/Socket.js"
        socket_js = source.read(socket_path).decode("utf-8") if socket_path in source.namelist() else None
        dispatcher_path = "assets/dist/src/docdispatcher.js"
        dispatcher_js = source.read(dispatcher_path).decode("utf-8") if dispatcher_path in source.namelist() else None
        ui_manager_path = "assets/dist/src/control/Control.UIManager.js"
        ui_manager_js = source.read(ui_manager_path).decode("utf-8") if ui_manager_path in source.namelist() else None
        alert_dialog_path = "assets/dist/src/control/Control.AlertDialog.js"
        alert_dialog_js = source.read(alert_dialog_path).decode("utf-8") if alert_dialog_path in source.namelist() else None
        if socket_js is not None:
            if OLD_SAVE_HANDLER in socket_js:
                socket_js = socket_js.replace(OLD_SAVE_HANDLER, NEW_SAVE_HANDLER, 1)
            elif "handler.onUniEditorSaveResult" not in socket_js:
                raise RuntimeError("Could not find the compiled save response bridge in source AAR")
            if "window.__uniCollaboraSaveForExit" not in socket_js:
                if socket_js.count(DISPATCH_MARKER) != 1:
                    raise RuntimeError("Could not find the compiled save dispatch insertion point")
                socket_js = socket_js.replace(DISPATCH_MARKER, SAVE_FOR_EXIT + DISPATCH_MARKER, 1)
            socket_js = socket_js.replace("this._map.sendUnoCommand('.uno:Save');", "this._map.save(false, false);")
            if "this._map.sendUnoCommand('.uno:Save')" in socket_js:
                raise RuntimeError("Save bridge still sends the forbidden .uno:Save command")
        if dispatcher_js is not None:
            if CLOSEAPP_MARKER in dispatcher_js:
                dispatcher_js = dispatcher_js.replace(CLOSEAPP_MARKER, CLOSEAPP_PATCH, 1)
            elif CLOSEAPP_PATCH not in dispatcher_js:
                raise RuntimeError("Could not find the mobile closeapp dispatch insertion point")
        if ui_manager_js is not None:
            if MOBILE_BACK_MARKER in ui_manager_js:
                ui_manager_js = ui_manager_js.replace(MOBILE_BACK_MARKER, MOBILE_BACK_PATCH, 1)
            elif MOBILE_BACK_PATCH not in ui_manager_js:
                raise RuntimeError("Could not find the mobile back handler insertion point")
        if socket_js is not None:
            if OLD_PASSWORD_GIVEUP in socket_js:
                socket_js = socket_js.replace(OLD_PASSWORD_GIVEUP, NEW_PASSWORD_GIVEUP, 1)
            elif NEW_PASSWORD_GIVEUP not in socket_js:
                raise RuntimeError("Could not find the mobile password-dismiss handler")
        if alert_dialog_js is not None:
            if OLD_FATAL_CLOSE in alert_dialog_js:
                alert_dialog_js = alert_dialog_js.replace(OLD_FATAL_CLOSE, NEW_FATAL_CLOSE, 1)
            elif NEW_FATAL_CLOSE not in alert_dialog_js:
                raise RuntimeError("Could not find the mobile fatal-dialog close handler")

        asset_replacements = prepare_webview_assets(source, args.node, args.esbuild_module)
        if socket_js is not None:
            asset_replacements[socket_path] = socket_js.encode("utf-8")
        if dispatcher_js is not None:
            asset_replacements[dispatcher_path] = dispatcher_js.encode("utf-8")
        if ui_manager_js is not None:
            asset_replacements[ui_manager_path] = ui_manager_js.encode("utf-8")
        if alert_dialog_js is not None:
            asset_replacements[alert_dialog_path] = alert_dialog_js.encode("utf-8")

        for item in source.infolist():
            is_asset = item.filename.startswith("assets/") and not item.is_dir()
            is_native = (
                item.filename.startswith("jni/{}/".format(args.abi))
                and item.filename.endswith(".so")
                and (args.include_core_native or Path(item.filename).name not in core_native)
            )
            if not (is_asset or is_native):
                continue
            if item.filename in asset_replacements:
                import io
                data = io.BytesIO(asset_replacements[item.filename])
            else:
                data = source.open(item)
            with data:
                digest, size = sha256_stream(data)
                data.seek(0)
                bundle_entry = ZipInfo(item.filename, date_time=item.date_time)
                bundle_entry.compress_type = (
                    ZIP_STORED
                    if is_asset and not item.filename.startswith("assets/dist/")
                    else ZIP_DEFLATED
                )
                bundle_entry.external_attr = item.external_attr
                bundle_entry.extra = item.extra
                with target.open(bundle_entry, "w") as output:
                    copyfileobj(data, output, length=1024 * 1024)
            inventory.append({
                "path": item.filename,
                "size": size,
                "sha256": digest,
                "kind": "native-library" if is_native else "asset",
            })

        manifest = {
            "schemaVersion": 1,
            "engineVersion": args.version,
            "abi": args.abi,
            "sourceArtifact": "io.github.tmkmk.collabora:collabora-engine:{}".format(args.version),
            "deploymentBasePath": "appsource/",
            "embeddedNativeLibraries": sorted(core_native) if not args.include_core_native else [],
            "webViewTarget": "chrome87",
            "files": inventory,
        }
        target.writestr(
            "runtime-manifest.json",
            json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True).encode("utf-8"),
        )

    with bundle.open("rb") as stream:
        bundle_hash, _ = sha256_stream(stream)
    sidecar = bundle.with_suffix(bundle.suffix + ".sha256")
    sidecar.write_text("{}  {}\n".format(bundle_hash, bundle.name), encoding="ascii")
    manifest_path = output_dir / "runtime-manifest.json"
    with ZipFile(bundle) as archive:
        manifest_path.write_bytes(archive.read("runtime-manifest.json"))

    print("Bundle: {}".format(bundle))
    print("Bytes: {:,}".format(bundle.stat().st_size))
    print("SHA-256: {}".format(bundle_hash))
    print("Files: {} (assets: {}, runtime native libraries: {})".format(
        len(inventory),
        sum(1 for row in inventory if row["kind"] == "asset"),
        sum(1 for row in inventory if row["kind"] == "native-library"),
    ))
    print("Manifest: {}".format(manifest_path))
    print("WebView: Chrome 87 compatible JavaScript; binary WebSocket messages guarded")


if __name__ == "__main__":
    main()
