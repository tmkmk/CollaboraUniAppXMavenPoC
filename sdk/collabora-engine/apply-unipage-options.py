"""Apply uni-app page-open options to the Android Engine source tree."""
from pathlib import Path
import argparse


def replace_once(path: Path, old: str, new: str) -> None:
    source = path.read_text(encoding="utf-8")
    if new in source:
        return
    if source.count(old) != 1:
        raise RuntimeError("Expected one patch location in {}".format(path))
    path.write_text(source.replace(old, new, 1), encoding="utf-8")


def insert_after(path: Path, marker: str, addition: str, sentinel: str) -> None:
    source = path.read_text(encoding="utf-8")
    if sentinel in source:
        return
    if source.count(marker) != 1:
        raise RuntimeError("Expected one insertion point in {}".format(path))
    path.write_text(source.replace(marker, marker + addition, 1), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path,
                        help="Root of the Collabora online source checkout")
    root = parser.parse_args().source
    android = root / "android/lib/src/main/java/org/libreoffice/androidlib/LOActivity.java"
    source = android.read_text(encoding="utf-8")
    if "UNI_EDITOR_COMMAND_ACTION" not in source:
        insert_after(
            android,
            'import android.content.ContentResolver;\n',
            'import android.content.BroadcastReceiver;\nimport android.content.IntentFilter;\n',
            'import android.content.BroadcastReceiver;'
        )
        insert_after(
            android,
            '    private boolean documentLoaded = false;\n',
            '    private static final String UNI_EDITOR_COMMAND_ACTION = "io.github.tmkmk.collabora.EDITOR_COMMAND";\n'
            '    private static final String UNI_EDITOR_EVENT_ACTION = "io.github.tmkmk.collabora.EDITOR_EVENT";\n'
            '    private static final String UNI_EDITOR_COMMAND_JSON = "io.github.tmkmk.collabora.COMMAND_JSON";\n'
            '    private static final String UNI_EDITOR_EVENT_JSON = "io.github.tmkmk.collabora.EVENT_JSON";\n'
            '    private final BroadcastReceiver uniEditorCommandReceiver = new BroadcastReceiver() {\n'
            '        @Override public void onReceive(Context context, Intent intent) {\n'
            '            String request = intent.getStringExtra(UNI_EDITOR_COMMAND_JSON);\n'
            '            if (request == null || mWebView == null) return;\n'
            '            String javascript = "window.__uniCollaboraDispatch && window.__uniCollaboraDispatch(" + JSONObject.quote(request) + ");";\n'
            '            mWebView.evaluateJavascript(javascript, null);\n'
            '        }\n'
            '    };\n'
            '    private boolean uniEditorCommandReceiverRegistered = false;\n',
            'UNI_EDITOR_COMMAND_ACTION'
        )
        insert_after(
            android,
            '        super.onCreate(savedInstanceState);\n',
            '        IntentFilter uniEditorCommandFilter = new IntentFilter(UNI_EDITOR_COMMAND_ACTION);\n'
            '        if (Build.VERSION.SDK_INT >= 33)\n'
            '            registerReceiver(uniEditorCommandReceiver, uniEditorCommandFilter, Context.RECEIVER_NOT_EXPORTED);\n'
            '        else\n'
            '            registerReceiver(uniEditorCommandReceiver, uniEditorCommandFilter);\n'
            '        uniEditorCommandReceiverRegistered = true;\n',
            'uniEditorCommandReceiverRegistered = true;'
        )
        replace_once(
            android,
            '    @JavascriptInterface\n    public void postMobileDebug(String message) {\n',
            '    @JavascriptInterface\n'
            '    public void onUniEditorEvent(String eventJson) {\n'
            '        Intent event = new Intent(UNI_EDITOR_EVENT_ACTION).setPackage(getPackageName());\n'
            '        event.putExtra(UNI_EDITOR_EVENT_JSON, eventJson);\n'
            '        sendBroadcast(event);\n'
            '    }\n\n'
            '    @JavascriptInterface\n'
            '    public void closeUniDocument() {\n'
            '        runOnUiThread(() -> finishWithProgress());\n'
            '    }\n\n'
            '    @JavascriptInterface\n    public void postMobileDebug(String message) {\n'
        )
        insert_after(
            android,
            '    protected void onDestroy() {\n',
            '        if (uniEditorCommandReceiverRegistered) {\n'
            '            try { unregisterReceiver(uniEditorCommandReceiver); } catch (IllegalArgumentException ignored) {}\n'
            '            uniEditorCommandReceiverRegistered = false;\n'
            '        }\n'
            '        onUniEditorEvent("{\\"type\\":\\"closed\\"}");\n',
            'onUniEditorEvent("{\\"type\\":\\"closed\\"}")'
        )
    insert_after(
        android,
        '    protected void onDestroy() {\n',
        '        onUniEditorEvent("{\\"type\\":\\"closed\\"}");\n',
        'onUniEditorEvent("{\\"type\\":\\"closed\\"}")'
    )
    if "UNI_WEB_OPTIONS" not in source:
        legacy_fields = ('' if 'UNI_OPEN_MODE' in source else
                         '    private String uniOpenMode;\n'
                         '    private String uniUserName;\n')
        insert_after(
            android,
            '    private static String USER_NAME_KEY = "USER_NAME";\n',
            '    private static final String UNI_OPEN_MODE = "io.github.tmkmk.collabora.OPEN_MODE";\n'
            '    private static final String UNI_USER_NAME = "io.github.tmkmk.collabora.USER_NAME";\n'
            '    private static final String UNI_WEB_OPTIONS = "io.github.tmkmk.collabora.WEB_OPTIONS";\n'
            '    private static final String UNI_ENABLE_TRACK_CHANGES = "io.github.tmkmk.collabora.ENABLE_TRACK_CHANGES";\n'
            + legacy_fields,
            'UNI_WEB_OPTIONS',
        )
    insert_after(android, '    private String uniUserName;\n',
                 '    private String uniWebOptionsJson;\n    private boolean uniEnableTrackChanges;\n',
                 'uniWebOptionsJson')
    replace_once(
        android,
        '        isDocDebuggable = sPrefs.getBoolean(KEY_ENABLE_SHOW_DEBUG_INFO, false) && BuildConfig.DEBUG;\n'
        '        mResolvedFile = null;\n',
        '        isDocDebuggable = sPrefs.getBoolean(KEY_ENABLE_SHOW_DEBUG_INFO, false) && BuildConfig.DEBUG;\n'
        '        mResolvedFile = null;\n'
        '        uniOpenMode = getIntent().getStringExtra(UNI_OPEN_MODE);\n'
        '        uniUserName = getIntent().getStringExtra(UNI_USER_NAME);\n'
        '        uniWebOptionsJson = getIntent().getStringExtra(UNI_WEB_OPTIONS);\n'
        '        uniEnableTrackChanges = getIntent().getBooleanExtra(UNI_ENABLE_TRACK_CHANGES, false);\n'
        '        if (uniUserName != null && !uniUserName.trim().isEmpty())\n'
        '            sPrefs.edit().putString(USER_NAME_KEY, uniUserName).apply();\n'
    )
    replace_once(
        android,
        '        if (!canDocumentBeExported())\n            isDocEditable = false;\n',
        '        if ("readonly".equals(uniOpenMode))\n            isDocEditable = false;\n'
        '        if (!canDocumentBeExported())\n            isDocEditable = false;\n',
    )
    replace_once(
        android,
        '        String userName = getPrefs().getString(USER_NAME_KEY, "Guest User");\n',
        '        String userName = uniUserName != null && !uniUserName.trim().isEmpty()\n'
        '                ? uniUserName : getPrefs().getString(USER_NAME_KEY, "Guest User");\n',
    )
    replace_once(android,
                 '        finalUrlToLoad += "&lang=" + language;\n',
                 '        finalUrlToLoad += "&lang=" + language;\n'
                 '        if ("revision".equals(uniOpenMode) || uniEnableTrackChanges)\n'
                 '            finalUrlToLoad += "&collaboraTrackChanges=true";\n')
    insert_after(android, '        // load the page\n',
                 '        finalUrlToLoad = appendUniWebOptions(finalUrlToLoad, uniWebOptionsJson);\n',
                 'appendUniWebOptions(finalUrlToLoad, uniWebOptionsJson)')
    helper_marker = '    private String appendUniWebOptions(String url, String optionsJson) {\n'
    helper = (
        '    private String appendUniWebOptions(String url, String optionsJson) {\n'
        '        if (optionsJson == null || optionsJson.trim().isEmpty()) return url;\n'
        '        try {\n'
        '            JSONObject options = new JSONObject(optionsJson);\n'
        '            java.util.Iterator<String> keys = options.keys();\n'
        '            while (keys.hasNext()) {\n'
        '                String key = keys.next();\n'
        '                if (!key.matches("[A-Za-z][A-Za-z0-9_.-]*") ||\n'
        '                        key.equalsIgnoreCase("file_path") || key.equalsIgnoreCase("permission") ||\n'
        '                        key.equalsIgnoreCase("closebutton") || key.equalsIgnoreCase("lang") ||\n'
        '                        key.equalsIgnoreCase("collaboraTrackChanges")) continue;\n'
        '                Object value = options.opt(key);\n'
        '                if (!(value instanceof String || value instanceof Number || value instanceof Boolean)) continue;\n'
        '                url += "&" + Uri.encode(key) + "=" + Uri.encode(String.valueOf(value));\n'
        '            }\n'
        '        } catch (Exception exception) {\n'
        '            Log.w(TAG, "Ignoring invalid uni-app web options", exception);\n'
        '        }\n'
        '        return url;\n'
        '    }\n\n'
    )
    if helper_marker not in android.read_text(encoding="utf-8"):
        replace_once(android, '    private void loadDocument() {\n', helper + '    private void loadDocument() {\n')

    command = "\t\t\tthis._map._fireInitComplete('statusindicatorfinish');"
    addition = (command + "\n"
                "\t\t\tthis.installUniCollaboraBridge();\n"
                "\t\t\tif (window.location.search.indexOf('collaboraTrackChanges=true') !== -1 && "
                "!this._map._uniTrackChangesRequested) {\n"
                "\t\t\t\tthis._map._uniTrackChangesRequested = true;\n"
                "\t\t\t\tthis._map.sendUnoCommand('.uno:TrackChanges');\n"
                "\t\t\t}")
    source_ts = root / "browser/src/app/Socket.ts"
    ts_content = source_ts.read_text(encoding="utf-8")
    if "this._map._uniTrackChangesRequested" not in ts_content:
        replace_once(source_ts, command + "\n", addition + "\n")
    elif "\nthis._map._fireInitComplete('statusindicatorfinish');" in ts_content:
        source_ts.write_text(
            ts_content.replace("\nthis._map._fireInitComplete('statusindicatorfinish');",
                               "\n\t\t\tthis._map._fireInitComplete('statusindicatorfinish');", 1),
            encoding="utf-8")
    bridge_methods = (
        "\tprivate uniCollaboraBridgeInstalled: boolean = false;\n\n"
        "\tprivate installUniCollaboraBridge(): void {\n"
        "\t\tif (this.uniCollaboraBridgeInstalled) return;\n"
        "\t\tthis.uniCollaboraBridgeInstalled = true;\n"
        "\t\tconst pendingSaves: Array<{ requestId: string; closeAfterSave: boolean }> = [];\n"
        "\t\tconst emit = (event: any): void => {\n"
        "\t\t\tconst handler = (window as any).COOLMessageHandler;\n"
        "\t\t\tif (handler && handler.onUniEditorEvent) handler.onUniEditorEvent(JSON.stringify(event));\n"
        "\t\t};\n"
        "\t\t(window as any).__uniCollaboraDispatch = (requestJson: string): void => {\n"
        "\t\t\tconst request = JSON.parse(requestJson);\n"
        "\t\t\tif (request.action === 'command') {\n"
        "\t\t\t\tthis._map.sendUnoCommand(request.command, request.args, request.force);\n"
        "\t\t\t\temit({ type: 'commandDispatched', requestId: request.requestId, command: request.command });\n"
        "\t\t\t} else if (request.action === 'save' || request.action === 'close') {\n"
        "\t\t\t\tconst closeAfterSave = request.action === 'close' && request.saveChanges !== false;\n"
        "\t\t\t\tif (request.action === 'close' && !closeAfterSave) {\n"
        "\t\t\t\t\t(window as any).COOLMessageHandler.closeUniDocument();\n"
        "\t\t\t\t\treturn;\n"
        "\t\t\t\t}\n"
        "\t\t\t\tpendingSaves.push({ requestId: request.requestId, closeAfterSave: closeAfterSave });\n"
        "\t\t\t\tthis._map.sendUnoCommand('.uno:Save');\n"
        "\t\t\t}\n"
        "\t\t};\n"
        "\t\tthis._map.on('postMessage', (event: any) => {\n"
        "\t\t\tif (event.msgId === 'Action_Save_Resp' && pendingSaves.length > 0) {\n"
        "\t\t\t\tconst pending = pendingSaves.shift()!;\n"
        "\t\t\t\temit({ type: 'saveCompleted', requestId: pending.requestId, success: event.args.success, result: event.args.result, errorMsg: event.args.errorMsg });\n"
        "\t\t\t\tif (pending.closeAfterSave && event.args.success) (window as any).COOLMessageHandler.closeUniDocument();\n"
        "\t\t\t}\n"
        "\t\t\tif (event.msgId === 'Doc_ModifiedStatus') emit({ type: 'modifiedStatus', modified: event.args.Modified });\n"
        "\t\t});\n"
        "\t\temit({ type: 'ready' });\n"
        "\t}\n\n"
    )
    if 'private installUniCollaboraBridge(): void {' not in source_ts.read_text(encoding='utf-8'):
        replace_once(source_ts, '\tprivate _onSocketClose(event?: Partial<CloseEvent>): void {\n',
                     bridge_methods + '\tprivate _onSocketClose(event?: Partial<CloseEvent>): void {\n')
    print("Applied uni-app document options and runtime command bridge to Engine source.")


if __name__ == "__main__":
    main()
