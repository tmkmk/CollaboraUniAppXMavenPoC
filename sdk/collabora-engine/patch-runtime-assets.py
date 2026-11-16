"""Make remote runtime Web and UNO assets load from verified private files."""
from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if new in source:
        return source
    if source.count(old) != 1:
        raise RuntimeError("Expected one {} patch point".format(label))
    return source.replace(old, new, 1)


def main() -> None:
    root = Path(__file__).resolve().parents[2] / "collabora-source/online/android/lib/src/main/java/org/libreoffice/androidlib"
    activity_path = root / "LOActivity.java"
    client_path = root / "COWebViewClient.java"
    activity = activity_path.read_text(encoding="utf-8")
    client = client_path.read_text(encoding="utf-8")

    if "private AssetManager runtimeAssetManager;" not in activity:
        activity = replace_once(
            activity,
            "    private COWebView mWebView = null;\n",
            "    private COWebView mWebView = null;\n    private AssetManager runtimeAssetManager;\n",
            "shared runtime AssetManager field",
        )
    old_close_dispatch = '''            case "BYE":
                requestSaveAndReturnToUniApp();
                return false;
            case "CLOSE_WINDOW":
                if (uniActivityRetained)
                    return false;
                if (uniSaveWriteBackInProgress || uniCloseRequested)
                    closeAfterSavePending = true;
                else
                    requestSaveAndReturnToUniApp();
                return false;
'''
    new_close_dispatch = '''            case "BYE":
                getMainHandler().post(() -> requestSaveAndReturnToUniApp());
                return false;
            case "CLOSE_WINDOW":
                if (uniActivityRetained)
                    return false;
                getMainHandler().post(() -> {
                    if (uniSaveWriteBackInProgress || uniCloseRequested)
                        closeAfterSavePending = true;
                    else
                        requestSaveAndReturnToUniApp();
                });
                return false;
'''
    if old_close_dispatch in activity:
        activity = replace_once(activity, old_close_dispatch, new_close_dispatch, "main-thread close and save dispatch")
    elif new_close_dispatch not in activity:
        raise RuntimeError("Expected the close and save dispatch patch point")
    activity = activity.replace(
        '            Object cookie = addAssetPath.invoke(getAssets(), archive.getAbsolutePath());',
        '            runtimeAssetManager = getAssets();\n'
        '            Object cookie = addAssetPath.invoke(runtimeAssetManager, archive.getAbsolutePath());',
    )
    activity = activity.replace(
        '            try (InputStream mountedUnorc = getAssets().open("program/unorc")) {',
        '            try (InputStream mountedUnorc = runtimeAssetManager.open("program/unorc")) {',
    )
    activity = activity.replace(
        '        AssetManager assetManager = getResources().getAssets();',
        '        AssetManager assetManager = runtimeAssetManager != null ? runtimeAssetManager : getResources().getAssets();',
    )

    runtime_asset_probe = '''            try (InputStream mountedUnorc = getAssets().open("program/unorc")) {
                byte[] probeBuffer = new byte[8192];
                int bytesRead = mountedUnorc.read(probeBuffer);
                Log.i(TAG, "Runtime AssetManager opened program/unorc; firstReadBytes=" + bytesRead);
            } catch (IOException exception) {
                Log.e(TAG, "Runtime AssetManager cannot open program/unorc", exception);
            }
'''
    runtime_asset_mount_point = '''            COWebViewClient.setRuntimeAssetsDirectory(webAssets);
            Log.i(TAG, "Mounted Collabora runtime assets from " + archivePath);
'''
    if "Runtime AssetManager opened program/unorc" not in activity:
        activity = replace_once(
            activity,
            runtime_asset_mount_point,
            '''            COWebViewClient.setRuntimeAssetsDirectory(webAssets);
''' + runtime_asset_probe + '''            Log.i(TAG, "Mounted Collabora runtime assets from " + archivePath);
''',
            "runtime asset mount diagnostic",
        )

    current_cache_key = 'private static final String UNI_RUNTIME_ASSETS_EXTRACTED = "UNI_RUNTIME_ASSETS_EXTRACTED_V5";'
    if current_cache_key not in activity:
        import re
        activity, replacement_count = re.subn(
            r'private static final String UNI_RUNTIME_ASSETS_EXTRACTED = "[^"]+";',
            current_cache_key,
            activity,
            count=1,
        )
        if replacement_count != 1:
            raise RuntimeError("Expected one runtime extraction cache key")

    helper = '''    private boolean extractUniRuntimeUnpack(File archive) {
        File dataDirectory = new File(getApplicationInfo().dataDir);
        try {
            String dataPath = dataDirectory.getCanonicalPath() + File.separator;
            int extractedFiles = 0;
            try (ZipFile zip = new ZipFile(archive)) {
                Enumeration<? extends ZipEntry> entries = zip.entries();
                byte[] buffer = new byte[64 * 1024];
                while (entries.hasMoreElements()) {
                    ZipEntry entry = entries.nextElement();
                    String entryName = entry.getName();
                    String relativePath;
                    if (entryName.startsWith("assets/unpack/")) {
                        relativePath = entryName.substring("assets/unpack/".length());
                    } else if (entryName.startsWith("assets/program/")) {
                        relativePath = entryName.substring("assets/".length());
                    } else if (entryName.startsWith("assets/share/")) {
                        relativePath = entryName.substring("assets/".length());
                    } else {
                        continue;
                    }
                    if (entry.isDirectory())
                        continue;

                    File target = new File(dataDirectory, relativePath);
                    if (!target.getCanonicalPath().startsWith(dataPath))
                        throw new IOException("Runtime archive contains an unsafe UNO asset path");
                    File parent = target.getParentFile();
                    if (parent == null || (!parent.mkdirs() && !parent.isDirectory()))
                        throw new IOException("Unable to create a UNO asset directory");

                    try (InputStream input = zip.getInputStream(entry);
                         OutputStream output = new FileOutputStream(target)) {
                        int count;
                        while ((count = input.read(buffer)) != -1)
                            output.write(buffer, 0, count);
                    }
                    extractedFiles++;
                }
            }

            if (extractedFiles == 0
                    || !new File(dataDirectory, "program/udkapi.rdb").isFile()
                    || !new File(dataDirectory, "program/offapi.rdb").isFile()
                    || !new File(dataDirectory, "program/oovbaapi.rdb").isFile()
                    || !new File(dataDirectory, "program/services.rdb").isFile())
                throw new IOException("Runtime archive is missing required UNO registries");

            File sofficerc = new File(dataDirectory, "program/sofficerc");
            File fundamentalrc = new File(dataDirectory, "program/fundamentalrc");
            // UNI_RUNTIME_BOOTSTRAP_DATA_DIR: Android's native filesystem cannot open APK asset paths.
            String dataUrl = "file://" + dataDirectory.getAbsolutePath();
            String sofficeConfiguration = new String(java.nio.file.Files.readAllBytes(sofficerc.toPath()), "UTF-8");
            sofficeConfiguration = sofficeConfiguration.replace(
                    "URE_BOOTSTRAP=file:///assets/program/fundamentalrc",
                    "URE_BOOTSTRAP=file://" + fundamentalrc.getAbsolutePath());
            java.nio.file.Files.write(sofficerc.toPath(), sofficeConfiguration.getBytes("UTF-8"));

            String fundamentalConfiguration = new String(java.nio.file.Files.readAllBytes(fundamentalrc.toPath()), "UTF-8");
            fundamentalConfiguration = fundamentalConfiguration.replace("BRAND_BASE_DIR=file:///assets", "BRAND_BASE_DIR=" + dataUrl);
            java.nio.file.Files.write(fundamentalrc.toPath(), fundamentalConfiguration.getBytes("UTF-8"));

            File unorc = new File(dataDirectory, "program/unorc");
            // UNI_RUNTIME_UNO_SERVICES_DATA_DIR: the downloaded archive is not an Android APK asset path.
            String unoConfiguration = new String(java.nio.file.Files.readAllBytes(unorc.toPath()), "UTF-8");
            String serviceRegistries = "UNO_SERVICES=file://"
                    + new File(dataDirectory, "program/services.rdb").getAbsolutePath()
                    + " file://"
                    + new File(dataDirectory, "program/services/services.rdb").getAbsolutePath();
            if (!unoConfiguration.contains("UNO_SERVICES="))
                throw new IOException("Runtime archive is missing the UNO_SERVICES configuration");
            unoConfiguration = unoConfiguration.replaceAll(
                    "(?m)^UNO_SERVICES=.*$",
                    java.util.regex.Matcher.quoteReplacement(serviceRegistries));
            java.nio.file.Files.write(unorc.toPath(), unoConfiguration.getBytes("UTF-8"));
            return true;
        } catch (IOException exception) {
            Log.e(TAG, "Unable to extract UNO runtime assets", exception);
            return false;
        }
    }

'''
    if "private boolean extractUniRuntimeUnpack(File archive)" not in activity:
        activity = replace_once(activity, "    private void deleteUniRuntimeFiles(File file) {\n", helper + "    private void deleteUniRuntimeFiles(File file) {\n", "UNO extraction helper")
    elif "UNI_RUNTIME_BOOTSTRAP_DATA_DIR" not in activity:
        start = activity.index("    private boolean extractUniRuntimeUnpack(File archive) {")
        end = activity.index("    private void deleteUniRuntimeFiles(File file) {\n", start)
        activity = activity[:start] + helper + activity[end:]

    load_runtime_html = '''        finalUrlToLoad = appendUniWebOptions(finalUrlToLoad, uniWebOptionsJson);
        if (runtimeArchivePath != null && !runtimeArchivePath.isEmpty()) {
            try {
                File runtimeHtml = new File(getFilesDir(), "collabora-runtime/0.1.4/web-assets/dist/cool.html");
                String html = new String(java.nio.file.Files.readAllBytes(runtimeHtml.toPath()), "UTF-8");
                String runtimeBaseUrl = Uri.fromFile(runtimeHtml).toString()
                        + finalUrlToLoad.substring(finalUrlToLoad.indexOf('?'));
                mWebView.loadDataWithBaseURL(runtimeBaseUrl, html, "text/html", "UTF-8", null);
            } catch (IOException exception) {
                Log.e(TAG, "Unable to load Collabora Web assets", exception);
                finish();
            }
        } else {
            mWebView.loadUrl(finalUrlToLoad);
        }
'''
    old_load_runtime_html = '''        finalUrlToLoad = appendUniWebOptions(finalUrlToLoad, uniWebOptionsJson);
        mWebView.loadUrl(finalUrlToLoad);
'''
    if old_load_runtime_html in activity:
        activity = replace_once(activity, old_load_runtime_html, load_runtime_html, "runtime WebView entry loader")
    elif "loadDataWithBaseURL(runtimeBaseUrl" not in activity:
        raise RuntimeError("Expected the runtime WebView entry loader")
    old_runtime_base_url = 'String runtimeBaseUrl = Uri.fromFile(runtimeHtml).toString()\n                        + finalUrlToLoad.substring(finalUrlToLoad.indexOf(\'?\'));'
    new_runtime_base_url = (
        'String runtimeBaseUrl = "https://appassets.androidplatform.net/assets/dist/cool.html"\n'
        '                        + finalUrlToLoad.substring(finalUrlToLoad.indexOf(\'?\'));'
    )
    activity = replace_once(activity, old_runtime_base_url, new_runtime_base_url, "runtime WebView base URL")

    original_apk_path = '        String apkFile = getApplication().getPackageResourcePath();\n'
    previous_runtime_archive = (
        original_apk_path
        + '        String runtimeArchivePath = getIntent().getStringExtra(UNI_RUNTIME_ASSET_PATH);\n'
        + '        if (runtimeArchivePath != null && !runtimeArchivePath.isEmpty())\n'
        + '            apkFile = runtimeArchivePath;\n'
    )
    current_runtime_archive = (
        original_apk_path
        + '        String runtimeArchivePath = getIntent().getStringExtra(UNI_RUNTIME_ASSET_PATH);\n'
        + '        if (runtimeArchivePath != null && !runtimeArchivePath.isEmpty()) {\n'
        + '            apkFile = runtimeArchivePath;\n'
        + '            Log.i(TAG, "Using runtime ZIP for native asset archive");\n'
        + '        }\n'
    )
    if previous_runtime_archive in activity:
        activity = replace_once(activity, previous_runtime_archive, current_runtime_archive, "native COKit runtime asset archive")
    elif current_runtime_archive not in activity:
        activity = replace_once(activity, original_apk_path, current_runtime_archive, "native COKit runtime asset archive")

    old_task = '''        new AsyncTask<Void, Void, Void>() {
            @Override
            protected Void doInBackground(Void... voids) {
                // copy the new assets
                if (copyFromAssets(getAssets(), "unpack", getApplicationInfo().dataDir)) {
                    if (usingRuntimeArchive) {
                        sPrefs.edit().putString(UNI_RUNTIME_ASSETS_EXTRACTED, runtimeArchiveVersion).apply();
                    } else {
                        sPrefs.edit().putString(ASSETS_EXTRACTED_GIT_COMMIT, BuildConfig.GIT_COMMIT).apply();
                    }
                }
                return null;
            }

            @Override
            protected void onPostExecute(Void aVoid) {
                initUI();
            }
        }.execute();
'''
    new_task = '''        new AsyncTask<Void, Void, Boolean>() {
            @Override
            protected Boolean doInBackground(Void... voids) {
                boolean copied;
                if (usingRuntimeArchive) {
                    copied = extractUniRuntimeUnpack(new File(runtimeArchivePath));
                } else {
                    copied = copyFromAssets(getAssets(), "unpack", getApplicationInfo().dataDir);
                }
                if (copied) {
                    String key = usingRuntimeArchive ? UNI_RUNTIME_ASSETS_EXTRACTED : ASSETS_EXTRACTED_GIT_COMMIT;
                    String value = usingRuntimeArchive ? runtimeArchiveVersion : BuildConfig.GIT_COMMIT;
                    sPrefs.edit().putString(key, value).apply();
                }
                return copied;
            }

            @Override
            protected void onPostExecute(Boolean copied) {
                if (!copied) {
                    mProgressDialog.dismiss();
                    Toast.makeText(LOActivity.this, "编辑器运行资源缺失，无法启动", Toast.LENGTH_LONG).show();
                    finish();
                    return;
                }
                initUI();
            }
        }.execute();
'''
    activity = replace_once(activity, old_task, new_task, "UNO extraction task")

    previous_entry = '''        String runtimePageUrl = COWebViewClient.getRuntimeAssetUrl("dist/cool.html");
        if (runtimePageUrl == null)
            runtimePageUrl = "file:///android_asset/dist/cool.html";
        String finalUrlToLoad = runtimePageUrl + "?file_path=" +
'''
    bundled_entry = '        String finalUrlToLoad = "file:///android_asset/dist/cool.html?file_path=" +\n'
    if previous_entry not in activity:
        activity = replace_once(activity, bundled_entry, previous_entry, "runtime Web entry URL")

    client_imports = {
        "import android.webkit.MimeTypeMap;": "import android.webkit.WebViewClient;\n",
        "import java.io.File;": "import java.io.ByteArrayInputStream;\n",
        "import java.io.FileInputStream;": "import java.io.File;\n",
        "import java.io.IOException;": "import java.io.InputStream;\n",
    }
    for import_line, after_line in client_imports.items():
        if import_line not in client:
            client = replace_once(client, after_line, after_line + import_line + "\n", "runtime asset import")

    if "private static volatile File runtimeAssetsDirectory;" not in client:
        client = replace_once(
            client,
            "public class COWebViewClient extends WebViewClient {\n",
            "public class COWebViewClient extends WebViewClient {\n"
            "    private static volatile File runtimeAssetsDirectory;\n\n"
            "    static void setRuntimeAssetsDirectory(File directory) {\n"
            "        runtimeAssetsDirectory = directory;\n"
            "    }\n\n",
            "runtime asset directory",
        )

    old_runtime_interception = (
        "        Uri uri = request.getUrl();\n"
        '        if (Objects.equals(uri.getScheme(), "file") && uri.getPath() != null\n'
        '                && uri.getPath().startsWith("/android_asset/")) {\n'
        "            WebResourceResponse runtimeAsset = openRuntimeAsset(uri.getPath());\n"
        "            if (runtimeAsset != null)\n"
        "                return runtimeAsset;\n"
        "        }\n\n"
    )
    new_runtime_interception = (
        "        Uri uri = request.getUrl();\n"
        '        String runtimeAssetPath = null;\n'
        '        if (Objects.equals(uri.getScheme(), "https")\n'
        '                && Objects.equals(uri.getHost(), "appassets.androidplatform.net")\n'
        '                && uri.getPath() != null && uri.getPath().startsWith("/assets/")) {\n'
        '            runtimeAssetPath = uri.getPath().substring("/assets/".length());\n'
        '        } else if (Objects.equals(uri.getScheme(), "file") && uri.getPath() != null\n'
        '                && uri.getPath().startsWith("/android_asset/")) {\n'
        '            runtimeAssetPath = uri.getPath().substring("/android_asset/".length());\n'
        '        }\n'
        '        if (runtimeAssetPath != null) {\n'
        '            WebResourceResponse runtimeAsset = openRuntimeAsset(runtimeAssetPath);\n'
        '            if (runtimeAsset != null)\n'
        '                return runtimeAsset;\n'
        '        }\n\n'
    )
    if old_runtime_interception in client:
        client = replace_once(client, old_runtime_interception, new_runtime_interception, "runtime asset request interception")
    elif "appassets.androidplatform.net" not in client:
        raise RuntimeError("Expected the runtime asset request interception patch point")

    if "private WebResourceResponse openRuntimeAsset(String assetPath)" not in client:
        client = replace_once(
            client,
            "    private WebResourceResponse handleMediaRequest(WebResourceRequest request) {\n",
            '''    @Nullable
    private WebResourceResponse openRuntimeAsset(String assetPath) {
        File root = runtimeAssetsDirectory;
        if (root == null)
            return null;

        try {
            File asset = new File(root, assetPath);
            String rootPath = root.getCanonicalPath() + File.separator;
            String assetCanonicalPath = asset.getCanonicalPath();
            if (!assetCanonicalPath.startsWith(rootPath) || !asset.isFile())
                return null;

            String extension = MimeTypeMap.getFileExtensionFromUrl(asset.getName()).toLowerCase(java.util.Locale.ROOT);
            String mimeType = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
            if (mimeType == null)
                mimeType = "application/octet-stream";
            String encoding = mimeType.startsWith("text/") || extension.equals("js") || extension.equals("json")
                    || extension.equals("svg") ? "UTF-8" : null;
            return new WebResourceResponse(mimeType, encoding, new FileInputStream(asset));
        } catch (IOException exception) {
            return null;
        }
    }

    private WebResourceResponse handleMediaRequest(WebResourceRequest request) {
''',
            "runtime asset response",
        )
    elif 'assetPath.substring("/android_asset/".length())' in client:
        old_relative_path = 'String relativePath = assetPath.substring("/android_asset/".length());\n'
        if client.count(old_relative_path) != 1:
            raise RuntimeError("Expected one runtime asset relative path")
        client = client.replace(old_relative_path, "", 1)
    client = client.replace(
        "                try {\n            File asset = new File(root, relativePath);\n",
        "        try {\n            File asset = new File(root, assetPath);\n",
        1,
    )

    if (
        "UNI_RUNTIME_ASSETS_EXTRACTED_V5" not in activity
        or 'COWebViewClient.getRuntimeAssetUrl("dist/cool.html")' not in activity
        or "apkFile = runtimeArchivePath;" not in activity
        or "Using runtime ZIP for native asset archive" not in activity
        or "loadDataWithBaseURL(runtimeBaseUrl" not in activity
    ):
        raise RuntimeError("Runtime asset patch verification failed")
    if "openRuntimeAsset(runtimeAssetPath)" not in client or "appassets.androidplatform.net" not in client or "private static volatile File runtimeAssetsDirectory;" not in client:
        raise RuntimeError("Runtime Web asset interception patch verification failed")
    activity_path.write_text(activity, encoding="utf-8")
    client = client.replace(
        'headers.put("Access-Control-Allow-Origin", "null"); // Yes, the origin really is \'null\' for \'file:\' origins',
        'headers.put("Access-Control-Allow-Origin", "*"); // The local COOL protocol is requested from the runtime WebView origin',
    )
    if 'headers.put("Access-Control-Allow-Origin", "null");' in client:
        raise RuntimeError("Runtime COOL responses still restrict CORS to the file origin")
    client_path.write_text(client, encoding="utf-8")
    print("Patched runtime ZIP extraction, native asset archive, and WebView entry URL")


if __name__ == "__main__":
    main()
