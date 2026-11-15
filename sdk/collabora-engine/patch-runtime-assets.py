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

    activity = replace_once(
        activity,
        'private static final String UNI_RUNTIME_ASSETS_EXTRACTED = "UNI_RUNTIME_ASSETS_EXTRACTED";',
        'private static final String UNI_RUNTIME_ASSETS_EXTRACTED = "UNI_RUNTIME_ASSETS_EXTRACTED_V2";',
        "runtime extraction cache key",
    )

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
                    String prefix = "assets/unpack/";
                    if (!entryName.startsWith(prefix) || entry.isDirectory())
                        continue;

                    File target = new File(dataDirectory, entryName.substring(prefix.length()));
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
                    || !new File(dataDirectory, "program/oovbaapi.rdb").isFile())
                throw new IOException("Runtime archive is missing required UNO type libraries");
            return true;
        } catch (IOException exception) {
            Log.e(TAG, "Unable to extract UNO runtime assets", exception);
            return false;
        }
    }

'''
    if "private boolean extractUniRuntimeUnpack(File archive)" not in activity:
        activity = replace_once(activity, "    private void deleteUniRuntimeFiles(File file) {\n", helper + "    private void deleteUniRuntimeFiles(File file) {\n", "UNO extraction helper")

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
    current_entry = '        String finalUrlToLoad = "file:///android_asset/dist/cool.html?file_path=" +\n'
    if previous_entry in activity:
        activity = replace_once(activity, previous_entry, current_entry, "runtime Web entry URL")
    elif current_entry not in activity:
        raise RuntimeError("Expected the runtime Web entry URL patch point")

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

    if "openRuntimeAsset(uri.getPath())" not in client:
        client = replace_once(
            client,
            "        Uri uri = request.getUrl();\n",
            "        Uri uri = request.getUrl();\n"
            '        if (Objects.equals(uri.getScheme(), "file") && uri.getPath() != null\n'
            '                && uri.getPath().startsWith("/android_asset/")) {\n'
            "            WebResourceResponse runtimeAsset = openRuntimeAsset(uri.getPath());\n"
            "            if (runtimeAsset != null)\n"
            "                return runtimeAsset;\n"
            "        }\n\n",
            "runtime asset request interception",
        )

    if "private WebResourceResponse openRuntimeAsset(String assetPath)" not in client:
        client = replace_once(
            client,
            "    private WebResourceResponse handleMediaRequest(WebResourceRequest request) {\n",
            '''    @Nullable
    private WebResourceResponse openRuntimeAsset(String assetPath) {
        File root = runtimeAssetsDirectory;
        if (root == null)
            return null;

        String relativePath = assetPath.substring("/android_asset/".length());
        try {
            File asset = new File(root, relativePath);
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

    if (
        "UNI_RUNTIME_ASSETS_EXTRACTED_V2" not in activity
        or "file:///android_asset/dist/cool.html?file_path=" not in activity
        or "apkFile = runtimeArchivePath;" not in activity
        or "Using runtime ZIP for native asset archive" not in activity
    ):
        raise RuntimeError("Runtime asset patch verification failed")
    if "openRuntimeAsset(uri.getPath())" not in client or "private static volatile File runtimeAssetsDirectory;" not in client:
        raise RuntimeError("Runtime Web asset interception patch verification failed")
    activity_path.write_text(activity, encoding="utf-8")
    client_path.write_text(client, encoding="utf-8")
    print("Patched runtime ZIP extraction, native asset archive, and WebView entry URL")


if __name__ == "__main__":
    main()
