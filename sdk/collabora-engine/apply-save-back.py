"""Patch the Android Engine source with reliable save-back and retained return behavior."""
import argparse
from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    source = path.read_text(encoding="utf-8")
    if new in source:
        return
    if source.count(old) != 1:
        raise RuntimeError("Expected one patch location in {}".format(path))
    path.write_text(source.replace(old, new, 1), encoding="utf-8")


def replace_between(path: Path, start: str, end: str, replacement: str) -> None:
    source = path.read_text(encoding="utf-8")
    start_at = source.find(start)
    end_at = source.find(end, start_at + len(start))
    if start_at < 0 or end_at < 0:
        raise RuntimeError("Patch boundary not found in {}".format(path))
    if replacement in source:
        return
    path.write_text(source[:start_at] + replacement + source[end_at:], encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Collabora online source checkout")
    root = parser.parse_args().source
    activity = root / "android/lib/src/main/java/org/libreoffice/androidlib/LOActivity.java"
    socket = root / "browser/src/app/Socket.ts"

    # The branch already imports InputStream. Add MessageDigest adjacent to Java IO imports.
    source = activity.read_text(encoding="utf-8")
    if "import java.security.MessageDigest;" not in source:
        replace_once(activity, "import java.io.OutputStream;\n", "import java.io.OutputStream;\nimport java.security.MessageDigest;\n")

    state = activity.read_text(encoding="utf-8")
    if "private final java.util.concurrent.ExecutorService uniSaveExecutor" not in state:
        replace_once(
            activity,
            "    private boolean uniEditorCommandReceiverRegistered = false;\n",
            "    private boolean uniEditorCommandReceiverRegistered = false;\n"
            "    private final java.util.concurrent.ExecutorService uniSaveExecutor = java.util.concurrent.Executors.newSingleThreadExecutor();\n"
            "    private volatile boolean uniSaveWriteBackInProgress = false;\n"
            "    private volatile boolean closeAfterSavePending = false;\n"
            "    private volatile boolean uniCloseRequested = false;\n"
            "    private boolean uniActivityRetained = false;\n",
        )
    else:
        replace_once(
            activity,
            "    private volatile boolean closeAfterSavePending = false;\n",
            "    private volatile boolean closeAfterSavePending = false;\n"
            "    private volatile boolean uniCloseRequested = false;\n",
        )

    replace_once(
        activity,
        '    @JavascriptInterface\n    public void closeUniDocument() {\n'
        '        runOnUiThread(() -> finishWithProgress());\n'
        '    }\n\n',
        '    @JavascriptInterface\n'
        '    public void onUniEditorSaveResult(String requestId, boolean engineSuccess, String result, String errorMsg, boolean closeAfterSave) {\n'
        '        uniSaveWriteBackInProgress = true;\n'
        '        uniSaveExecutor.execute(() -> {\n'
        '            boolean success = engineSuccess;\n'
        '            String failure = errorMsg == null ? "" : errorMsg;\n'
        '            if (success && !copyTempBackToIntent()) {\n'
        '                success = false;\n'
        '                failure = "编辑器已保存，但写回原文件失败；原文件未确认更新。";\n'
        '            }\n'
        '            uniSaveWriteBackInProgress = false;\n'
        '            JSONObject event = new JSONObject();\n'
        '            try {\n'
        '                event.put("type", "saveCompleted");\n'
        '                event.put("requestId", requestId == null ? "" : requestId);\n'
        '                event.put("success", success);\n'
        '                event.put("result", result == null ? "" : result);\n'
        '                event.put("errorMsg", failure);\n'
        '            } catch (Exception ignored) {}\n'
        '            final boolean saveSucceeded = success;\n'
        '            runOnUiThread(() -> {\n'
        '                onUniEditorEvent(event.toString());\n'
        '                if (closeAfterSave || closeAfterSavePending) {\n'
        '                    closeAfterSavePending = false;\n'
        '                    if (saveSucceeded) returnToUniAppWithoutDestroy();\n'
        '                    else { uniCloseRequested = false; reportSaveToFileFailed(); }\n'
        '                }\n'
        '            });\n'
        '        });\n'
        '    }\n\n'
        '    @JavascriptInterface\n'
        '    public void closeUniDocument() {\n'
        '        runOnUiThread(() -> requestSaveAndReturnToUniApp());\n'
        '    }\n\n',
    )

    replace_once(
        activity,
        '                finishWithProgress();\n'
        '            }\n'
        '        });\n\n'
        '        startWatchingForHardwareKeyboard();\n',
        '                requestSaveAndReturnToUniApp();\n'
        '            }\n'
        '        });\n\n'
        '        startWatchingForHardwareKeyboard();\n',
    )

    # The runtime ZIP is an Android asset package. Mount it before init() copies
    # unpacked files or creates the WebView. Reflection handles hidden SDK stubs.
    if "UNI_RUNTIME_ASSETS_EXTRACTED" not in activity.read_text(encoding="utf-8"):
        replace_once(
            activity,
            '    private static final String UNI_RUNTIME_ASSET_PATH = "io.github.tmkmk.collabora.RUNTIME_ASSET_PATH";\n',
            '    private static final String UNI_RUNTIME_ASSET_PATH = "io.github.tmkmk.collabora.RUNTIME_ASSET_PATH";\n'
            '    private static final String UNI_RUNTIME_ASSETS_EXTRACTED = "UNI_RUNTIME_ASSETS_EXTRACTED";\n',
        )
    if "UNI_RUNTIME_NATIVE_LIB_DIR" not in activity.read_text(encoding="utf-8"):
        replace_once(
            activity,
            '    private static final String UNI_RUNTIME_ASSET_PATH = "io.github.tmkmk.collabora.RUNTIME_ASSET_PATH";\n',
            '    private static final String UNI_RUNTIME_ASSET_PATH = "io.github.tmkmk.collabora.RUNTIME_ASSET_PATH";\n'
            '    private static final String UNI_RUNTIME_NATIVE_LIB_DIR = "io.github.tmkmk.collabora.RUNTIME_NATIVE_LIB_DIR";\n',
        )
    replace_once(
        activity,
        '    private void init() {\n'
        '        if (sPrefs.getString(ASSETS_EXTRACTED_GIT_COMMIT, "").equals(BuildConfig.GIT_COMMIT)) {\n'
        '            // all is fine, we have already copied the assets\n'
        '            initUI();\n'
        '            return;\n'
        '        }\n',
        '    private void init() {\n'
        '        String runtimeArchivePath = getIntent().getStringExtra(UNI_RUNTIME_ASSET_PATH);\n'
        '        boolean usingRuntimeArchive = runtimeArchivePath != null && !runtimeArchivePath.isEmpty();\n'
        '        String runtimeArchiveVersion = usingRuntimeArchive ? new File(runtimeArchivePath).getName() : "";\n'
        '        boolean runtimeAssetsExtracted = usingRuntimeArchive && sPrefs.getString(UNI_RUNTIME_ASSETS_EXTRACTED, "").equals(runtimeArchiveVersion);\n'
        '        boolean bundledAssetsExtracted = !usingRuntimeArchive && sPrefs.getString(ASSETS_EXTRACTED_GIT_COMMIT, "").equals(BuildConfig.GIT_COMMIT);\n'
        '        if (runtimeAssetsExtracted || bundledAssetsExtracted) {\n'
        '            // Runtime archives and embedded AAR assets have independent extraction state.\n'
        '            initUI();\n'
        '            return;\n'
        '        }\n',
    )
    replace_once(
        activity,
        '                if (copyFromAssets(getAssets(), "unpack", getApplicationInfo().dataDir)) {\n'
        '                    sPrefs.edit().putString(ASSETS_EXTRACTED_GIT_COMMIT, BuildConfig.GIT_COMMIT).apply();\n'
        '                }\n',
        '                if (copyFromAssets(getAssets(), "unpack", getApplicationInfo().dataDir)) {\n'
        '                    if (usingRuntimeArchive) {\n'
        '                        sPrefs.edit().putString(UNI_RUNTIME_ASSETS_EXTRACTED, runtimeArchiveVersion).apply();\n'
        '                    } else {\n'
        '                        sPrefs.edit().putString(ASSETS_EXTRACTED_GIT_COMMIT, BuildConfig.GIT_COMMIT).apply();\n'
        '                    }\n'
        '                }\n',
    )
    replace_once(
        activity,
        '        super.onCreate(savedInstanceState);\n        IntentFilter uniEditorCommandFilter = new IntentFilter(UNI_EDITOR_COMMAND_ACTION);\n',
        '        super.onCreate(savedInstanceState);\n'
        '        mountUniRuntimeAssets();\n'
        '        IntentFilter uniEditorCommandFilter = new IntentFilter(UNI_EDITOR_COMMAND_ACTION);\n',
    )
    if "private void mountUniRuntimeAssets()" not in activity.read_text(encoding="utf-8"):
        replace_once(
            activity,
            '    @Override\n    protected void onCreate(Bundle savedInstanceState) {\n',
            '''    private void mountUniRuntimeAssets() {
        String archivePath = getIntent().getStringExtra(UNI_RUNTIME_ASSET_PATH);
        if (archivePath == null || archivePath.isEmpty())
            return; // Retain compatibility with applications using the full embedded AAR.

        File archive = new File(archivePath);
        if (!archive.isFile())
            throw new IllegalStateException("Collabora runtime asset archive is missing: " + archivePath);
        try {
            java.lang.reflect.Method addAssetPath = AssetManager.class.getDeclaredMethod("addAssetPath", String.class);
            addAssetPath.setAccessible(true);
            Object cookie = addAssetPath.invoke(getAssets(), archive.getAbsolutePath());
            if (!(cookie instanceof Integer) || ((Integer) cookie) == 0)
                throw new IllegalStateException("Android rejected the Collabora runtime asset archive");
            Log.i(TAG, "Mounted Collabora runtime assets from " + archivePath);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to mount Collabora runtime assets", exception);
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
''',
        )

    if "private void loadRuntimeNativeLibraries()" not in activity.read_text(encoding="utf-8"):
        replace_once(
            activity,
            '    static {\n        System.loadLibrary("androidapp");\n    }\n',
            '''    private static boolean runtimeNativeLibrariesLoaded = false;

    private void loadRuntimeNativeLibraries() {
        if (runtimeNativeLibrariesLoaded)
            return;

        String runtimeLibraryDirectory = getIntent().getStringExtra(UNI_RUNTIME_NATIVE_LIB_DIR);
        if (runtimeLibraryDirectory == null || runtimeLibraryDirectory.isEmpty()) {
            System.loadLibrary("androidapp");
            runtimeNativeLibrariesLoaded = true;
            return;
        }

        try {
            File libraryDirectory = new File(runtimeLibraryDirectory);
            String appFilesPath = getFilesDir().getCanonicalPath() + File.separator;
            String libraryPath = libraryDirectory.getCanonicalPath();
            if (!libraryPath.startsWith(appFilesPath))
                throw new IllegalStateException("Collabora native libraries must be inside app storage");

            System.loadLibrary("c++_shared");
            String[] libraries = {
                "libnspr4.so", "libplc4.so", "libplds4.so", "libnssutil3.so",
                "libfreebl3.so", "libsqlite3.so", "libnss3.so", "libnssckbi.so",
                "libnssdbm3.so", "libsoftokn3.so", "libsmime3.so", "libssl3.so",
                "liblo-native-code.so"
            };
            for (String libraryName : libraries) {
                File library = new File(libraryDirectory, libraryName);
                if (!library.isFile() || library.canWrite())
                    throw new IllegalStateException("Collabora runtime library is missing or writable: " + library);
                System.load(library.getAbsolutePath());
                Log.i(TAG, "Loaded runtime library " + libraryName + " in editor process");
            }
            System.loadLibrary("androidapp");
            runtimeNativeLibrariesLoaded = true;
        } catch (Exception | UnsatisfiedLinkError exception) {
            throw new IllegalStateException("Unable to load Collabora native libraries in editor process", exception);
        }
    }
''',
        )

    replace_once(
        activity,
        '        createCOOLWSD(dataDir, cacheDir, apkFile, assetManager, urlToLoad, uiMode, userName);\n',
        '        loadRuntimeNativeLibraries();\n'
        '        createCOOLWSD(dataDir, cacheDir, apkFile, assetManager, urlToLoad, uiMode, userName);\n',
    )

    # Reuse the retained editor instance when Vue opens the same source document again.
    replace_once(
        activity,
        '    protected void onNewIntent(Intent intent) {\n\n'
        '        Log.i(TAG, "onNewIntent");\n\n',
        '    protected void onNewIntent(Intent intent) {\n\n'
        '        Log.i(TAG, "onNewIntent");\n'
        '        Uri currentUri = getIntent().getData();\n'
        '        Uri incomingUri = intent.getData();\n'
        '        String currentSource = getIntent().getStringExtra("io.github.tmkmk.collabora.SOURCE_URI");\n'
        '        String incomingSource = intent.getStringExtra("io.github.tmkmk.collabora.SOURCE_URI");\n'
        '        boolean sameDocument = currentSource != null && currentSource.equals(incomingSource);\n'
        '        if (!sameDocument && currentSource == null && incomingSource == null)\n'
        '            sameDocument = currentUri != null && currentUri.equals(incomingUri);\n'
        '        if (documentLoaded && uniActivityRetained && sameDocument) {\n'
        '            super.onNewIntent(intent);\n'
        '            setIntent(intent);\n'
        '            uniActivityRetained = false;\n'
        '            uniCloseRequested = false;\n'
        '            closeAfterSavePending = false;\n'
        '            onUniEditorEvent("{\\"type\\":\\"ready\\"}");\n'
        '            return;\n'
        '        }\n\n',
    )

    replace_once(
        activity,
        '    protected void onDestroy() {\n',
        '    protected void onDestroy() {\n'
        '        Log.w(TAG, "onDestroy retained=" + uniActivityRetained\n'
        '                + " finishing=" + isFinishing()\n'
        '                + " changingConfigurations=" + isChangingConfigurations());\n',
    )

    save_back_source = activity.read_text(encoding="utf-8")
    old_file_uri_guard = '''        if (!isDocEditable || mTempFile == null || !mTempFile.isFile() || getIntent().getData() == null)
            return false;

        Uri uri = getIntent().getData();
        if (!ContentResolver.SCHEME_CONTENT.equals(uri.getScheme()))
            return true; // file:// documents are saved in place by the Engine.
'''
    new_file_uri_guard = '''        if (!isDocEditable || getIntent().getData() == null)
            return false;

        Uri uri = getIntent().getData();
        if (ContentResolver.SCHEME_FILE.equals(uri.getScheme()))
            return true; // The Engine writes file:// documents directly in place.
        if (!ContentResolver.SCHEME_CONTENT.equals(uri.getScheme()))
            return false;
        if (mTempFile == null || !mTempFile.isFile())
            return false;
'''
    if old_file_uri_guard in save_back_source:
        replace_once(activity, old_file_uri_guard, new_file_uri_guard)
    elif "private boolean copyTempBackToIntent()" not in save_back_source:
        replace_between(
            activity,
            "    private void copyTempBackToIntent() {\n",
            "    /** Copy the temp file back to the document. */\n",
            '''    private boolean copyTempBackToIntent() {
        if (!isDocEditable || getIntent().getData() == null)
            return false;

        Uri uri = getIntent().getData();
        if (ContentResolver.SCHEME_FILE.equals(uri.getScheme()))
            return true; // The Engine writes file:// documents directly in place.
        if (!ContentResolver.SCHEME_CONTENT.equals(uri.getScheme()))
            return false;
        if (mTempFile == null || !mTempFile.isFile())
            return false;
        if (mResolvedFile != null)
            return copyTempBackToFile();

        ContentResolver resolver = getContentResolver();
        FileInputStream input = null;
        OutputStream output = null;
        try {
            String expectedHash = sha256(new FileInputStream(mTempFile));
            input = new FileInputStream(mTempFile);
            try {
                output = resolver.openOutputStream(uri, "wt");
            } catch (FileNotFoundException exception) {
                Log.i(TAG, "Provider rejected wt mode; retrying default output mode: " + exception.getMessage());
                output = resolver.openOutputStream(uri);
            }
            if (output == null)
                throw new IOException("Content provider returned no writable stream");

            byte[] buffer = new byte[16384];
            int length;
            long copied = 0;
            while ((length = input.read(buffer)) != -1) {
                output.write(buffer, 0, length);
                copied += length;
            }
            output.flush();
            output.close();
            output = null;
            input.close();
            input = null;

            if (copied != mTempFile.length())
                throw new IOException("Written byte count does not match the saved document");
            InputStream verifyInput = resolver.openInputStream(uri);
            if (verifyInput == null)
                throw new IOException("Content provider did not allow verifying the written document");
            String actualHash = sha256(verifyInput);
            if (!expectedHash.equals(actualHash))
                throw new IOException("Written document content does not match the saved document");

            Log.i(TAG, "Verified write-back of " + copied + " bytes to " + uri);
            return true;
        } catch (Exception exception) {
            Log.e(TAG, "copyTempBackToIntent failed: " + exception.getMessage(), exception);
            return false;
        } finally {
            try { if (input != null) input.close(); } catch (Exception ignored) {}
            try { if (output != null) output.close(); } catch (Exception ignored) {}
        }
    }

    private String sha256(InputStream input) throws Exception {
        try (InputStream stream = input) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[16384];
            int length;
            while ((length = stream.read(buffer)) != -1)
                digest.update(buffer, 0, length);
            StringBuilder value = new StringBuilder();
            for (byte b : digest.digest()) value.append(String.format(java.util.Locale.ROOT, "%02x", b));
            return value.toString();
        }
    }

    private void requestSaveAndReturnToUniApp() {
        if (uniActivityRetained || uniCloseRequested)
            return;
        if (!documentLoaded) {
            returnToUniAppWithoutDestroy();
            return;
        }
        if (!isDocEditable) {
            returnToUniAppWithoutDestroy();
            return;
        }
        if (mWebView == null) {
            reportSaveToFileFailed();
            return;
        }
        uniCloseRequested = true;
        mWebView.evaluateJavascript("window.__uniCollaboraSaveForExit && window.__uniCollaboraSaveForExit()", null);
    }

    private void returnToUniAppWithoutDestroy() {
        if (!uniActivityRetained) {
            uniActivityRetained = true;
            onUniEditorEvent("{\\"type\\":\\"returned\\"}");
        }
        Intent hostIntent = new Intent();
        hostIntent.setClassName(getPackageName(), "io.dcloud.PandoraEntryActivity");
        hostIntent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        Log.i(TAG, "Returning directly to the existing UniApp activity");
        try {
            startActivity(hostIntent);
        } catch (ActivityNotFoundException exception) {
            Log.e(TAG, "Unable to return to UniApp; keeping the editor activity alive", exception);
        }
    }

''',
        )

    if "private void copyTempBackToFile()" in activity.read_text(encoding="utf-8"):
        replace_once(
            activity,
            '            if (!newContent.renameTo(resolvedFile)) {\n'
            '                Log.e(TAG, "failed to put the new content in place of " + resolvedFile);\n'
            '                newContent.delete();\n'
            '                reportSaveToFileFailed();\n'
            '                return;\n'
            '            }\n',
            '            if (!newContent.renameTo(resolvedFile)) {\n'
            '                Log.e(TAG, "failed to put the new content in place of " + resolvedFile);\n'
            '                newContent.delete();\n'
            '                return false;\n'
            '            }\n',
        )
        replace_once(
            activity,
            '            MediaScannerConnection.scanFile(this, new String[]{resolvedFile.getAbsolutePath()}, null, null);\n'
            '        } catch (Exception e) {\n'
            '            Log.e(TAG, "copyTempBackToFile: " + e.getMessage());\n'
            '            newContent.delete();\n'
            '            reportSaveToFileFailed();\n'
            '        }\n'
            '    }\n',
            '            MediaScannerConnection.scanFile(this, new String[]{resolvedFile.getAbsolutePath()}, null, null);\n'
            '            return true;\n'
            '        } catch (Exception e) {\n'
            '            Log.e(TAG, "copyTempBackToFile: " + e.getMessage());\n'
            '            newContent.delete();\n'
            '            return false;\n'
            '        }\n'
            '    }\n',
        )
        replace_once(
            activity,
            '    private void copyTempBackToFile() {\n',
            '    private boolean copyTempBackToFile() {\n',
        )
    replace_between(
        activity,
        '    private boolean copyTempBackToFile() {\n',
        '    /** Tell the user that the document still holds the content it had before this save. */\n',
        '''    private boolean copyTempBackToFile() {
        final File resolvedFile = mResolvedFile;
        if (resolvedFile == null || mTempFile == null || !mTempFile.isFile())
            return false;

        File parent = resolvedFile.getParentFile();
        if (parent == null || !parent.isDirectory() || !parent.canWrite())
            return false;
        File newContent = new File(parent, "." + resolvedFile.getName() + ".part");
        try {
            long bytes = 0;
            try (InputStream input = new FileInputStream(mTempFile);
                 FileOutputStream output = new FileOutputStream(newContent)) {
                byte[] buffer = new byte[16384];
                int length;
                while ((length = input.read(buffer)) != -1) {
                    output.write(buffer, 0, length);
                    bytes += length;
                }
                output.flush();
                output.getFD().sync();
            }
            if (bytes != mTempFile.length() || !newContent.renameTo(resolvedFile)) {
                newContent.delete();
                return false;
            }
            MediaScannerConnection.scanFile(this, new String[]{resolvedFile.getAbsolutePath()}, null, null);
            return true;
        } catch (Exception exception) {
            Log.e(TAG, "copyTempBackToFile failed: " + exception.getMessage(), exception);
            newContent.delete();
            return false;
        }
    }

''',
    )

    replace_once(
        activity,
        '            case "BYE":\n'
        '                finishWithProgress();\n'
        '                return false;\n',
        '            case "BYE":\n'
        '                requestSaveAndReturnToUniApp();\n'
        '                return false;\n'
        '            case "CLOSE_WINDOW":\n'
        '                if (uniActivityRetained)\n'
        '                    return false;\n'
        '                if (uniSaveWriteBackInProgress || uniCloseRequested)\n'
        '                    closeAfterSavePending = true;\n'
        '                else\n'
        '                    requestSaveAndReturnToUniApp();\n'
        '                return false;\n',
    )
    replace_once(
        activity,
        '            case "SAVE":\n'
        '                copyTempBackToIntent();\n'
        '                sendBroadcast(messageAndParam[0], messageAndParam[1]);\n',
        '            case "SAVE":\n'
        '                sendBroadcast(messageAndParam[0], messageAndParam[1]);\n',
    )

    # Serialize the Engine response with the provider write-back before reporting success to UTS.
    socket_source = socket.read_text(encoding="utf-8")
    old = (
        "\t\t\tif (event.msgId === 'Action_Save_Resp' && pendingSaves.length > 0) {\n"
        "\t\t\t\tconst pending = pendingSaves.shift()!;\n"
        "\t\t\t\temit({ type: 'saveCompleted', requestId: pending.requestId, success: event.args.success, result: event.args.result, errorMsg: event.args.errorMsg });\n"
        "\t\t\t\tif (pending.closeAfterSave && event.args.success) (window as any).COOLMessageHandler.closeUniDocument();\n"
        "\t\t\t}\n"
    )
    new = (
        "\t\t\tif (event.msgId === 'Action_Save_Resp') {\n"
        "\t\t\t\tconst pending = pendingSaves.length > 0 ? pendingSaves.shift()! : { requestId: '', closeAfterSave: false };\n"
        "\t\t\t\tconst handler = (window as any).COOLMessageHandler;\n"
        "\t\t\t\tif (handler && handler.onUniEditorSaveResult) {\n"
        "\t\t\t\t\thandler.onUniEditorSaveResult(pending.requestId, event.args.success === true, event.args.result || '', event.args.errorMsg || '', pending.closeAfterSave);\n"
        "\t\t\t\t} else {\n"
        "\t\t\t\t\temit({ type: 'saveCompleted', requestId: pending.requestId, success: false, errorMsg: '原生保存桥不可用' });\n"
        "\t\t\t\t}\n"
        "\t\t\t}\n"
    )
    replace_once(socket, old, new)
    replace_once(
        socket,
        "\t\t(window as any).__uniCollaboraDispatch = (requestJson: string): void => {\n",
        "\t\t(window as any).__uniCollaboraSaveForExit = (): void => {\n"
        "\t\t\tconst requestId = 'native-back-' + Date.now().toString();\n"
        "\t\t\tpendingSaves.push({ requestId: requestId, closeAfterSave: true });\n"
        "\t\t\tthis._map.sendUnoCommand('.uno:Save');\n"
        "\t\t};\n"
        "\t\t(window as any).__uniCollaboraDispatch = (requestJson: string): void => {\n",
    )
    print("Applied confirmed Engine save-back, SAF write verification, and retained return behavior.")


if __name__ == "__main__":
    main()
