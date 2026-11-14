from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import shutil

root = Path('/opt/collabora-toolchain')
source = root / 'src/online/android/build/lib/outputs/aar/lib-debug.aar'
native = root / 'word-only/jni/liblo-native-code.so'
target = root / 'word-only/collabora-engine-word-native.aar'
excluded = ('assets/dist/videobackgrounds/', 'assets/dist/templates/files/presentation/',
            'assets/dist/templates/files/spreadsheet/', 'assets/share/gallery/')
with ZipFile(source) as src, ZipFile(target, 'w', ZIP_DEFLATED, compresslevel=9) as dst:
    for entry in src.infolist():
        if entry.filename.startswith(excluded):
            continue
        if entry.filename == 'jni/arm64-v8a/liblo-native-code.so':
            dst.write(native, entry.filename)
        else:
            with src.open(entry) as reader, dst.open(entry, 'w') as writer:
                shutil.copyfileobj(reader, writer, 1024 * 1024)
print(target, target.stat().st_size)
