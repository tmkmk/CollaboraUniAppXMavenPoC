from pathlib import Path
path = Path('/opt/collabora-toolchain/src/online/android/lib/src/main/java/org/libreoffice/androidlib/LOActivity.java')
source = path.read_text(encoding='utf-8')
old = '''        if (!isDocEditable || mTempFile == null || !mTempFile.isFile() || getIntent().getData() == null)
            return false;

        Uri uri = getIntent().getData();
        if (!ContentResolver.SCHEME_CONTENT.equals(uri.getScheme()))
            return true; // file:// documents are saved in place by the Engine.
'''
new = '''        if (!isDocEditable || getIntent().getData() == null)
            return false;

        Uri uri = getIntent().getData();
        if (ContentResolver.SCHEME_FILE.equals(uri.getScheme()))
            return true; // The Engine writes file:// documents directly in place.
        if (!ContentResolver.SCHEME_CONTENT.equals(uri.getScheme()))
            return false;
        if (mTempFile == null || !mTempFile.isFile())
            return false;
'''
if new in source:
    print('Already patched')
elif source.count(old) == 1:
    path.write_text(source.replace(old, new, 1), encoding='utf-8')
    print('Patched file:// save verification guard')
else:
    raise SystemExit('Expected exactly one old guard; source was not changed')
