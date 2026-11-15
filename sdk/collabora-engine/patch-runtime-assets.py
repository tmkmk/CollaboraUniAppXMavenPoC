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

    activity = replace_once(
        activity,
        '        String finalUrlToLoad = "file:///android_asset/dist/cool.html?file_path=" +\n',
        '        String runtimePageUrl = COWebViewClient.getRuntimeAssetUrl("dist/cool.html");\n'
        '        if (runtimePageUrl == null)\n'
        '            runtimePageUrl = "file:///android_asset/dist/cool.html";\n'
        '        String finalUrlToLoad = runtimePageUrl + "?file_path=" +\n',
        "runtime Web entry URL",
    )

    method = '''    static String getRuntimeAssetUrl(String relativePath) {
        File root = runtimeAssetsDirectory;
        if (root == null)
            return null;

        try {
            File asset = new File(root, relativePath);
            String rootPath = root.getCanonicalPath() + File.separator;
            String assetPath = asset.getCanonicalPath();
            if (!assetPath.startsWith(rootPath) || !asset.isFile())
                return null;
            return Uri.fromFile(asset).toString();
        } catch (IOException exception) {
            return null;
        }
    }

'''
    if "static String getRuntimeAssetUrl(String relativePath)" not in client:
        client = replace_once(
            client,
            "    public COWebViewClient() {\n",
            method + "    public COWebViewClient() {\n",
            "runtime asset URL helper",
        )

    if "UNI_RUNTIME_ASSETS_EXTRACTED_V2" not in activity or "getRuntimeAssetUrl(\"dist/cool.html\")" not in activity:
        raise RuntimeError("Runtime asset patch verification failed")
    activity_path.write_text(activity, encoding="utf-8")
    client_path.write_text(client, encoding="utf-8")
    print("Patched runtime ZIP extraction and WebView entry URL")


if __name__ == "__main__":
    main()
