"""Remove downloadable Engine assets and JNI libraries from the Maven AAR."""
from __future__ import annotations

import argparse
from copy import copy
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def main() -> None:
    repo = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default="0.1.5")
    parser.add_argument("--source", type=Path, required=True, help="Fresh Engine release AAR")
    args = parser.parse_args()

    target = repo / "sdk/collabora-engine/build/repo/org/libreoffice/collabora-engine/{0}-poc/collabora-engine-{0}-poc.aar".format(args.version)
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_suffix(".aar.part")
    core_libraries = {"libandroidapp.so", "libc++_shared.so"}
    kept_assets = {"assets/license.html", "assets/notice.txt"}
    kept_native: set[str] = set()
    removed_assets = 0
    removed_native = 0

    with ZipFile(args.source) as source, ZipFile(temp, "w", ZIP_DEFLATED, compresslevel=1, allowZip64=True) as output:
        for item in source.infolist():
            name = item.filename
            if name.startswith("assets/") and name not in kept_assets:
                removed_assets += 1
                continue
            if name.startswith("jni/") and name.endswith(".so") and Path(name).name not in core_libraries:
                removed_native += 1
                continue
            with source.open(item) as input_stream, output.open(copy(item), "w") as output_stream:
                while chunk := input_stream.read(1024 * 1024):
                    output_stream.write(chunk)
            if name.startswith("jni/") and name.endswith(".so"):
                kept_native.add(name)

    if kept_native != {
        "jni/arm64-v8a/libandroidapp.so",
        "jni/arm64-v8a/libc++_shared.so",
    }:
        temp.unlink(missing_ok=True)
        raise RuntimeError("Unexpected embedded runtime libraries: {}".format(sorted(kept_native)))
    with ZipFile(temp) as artifact:
        names = set(artifact.namelist())
        if not kept_assets.issubset(names) or any(name.startswith("assets/") and name not in kept_assets for name in names):
            raise RuntimeError("The thin AAR still contains runtime assets")
        metadata = artifact.read("META-INF/com/android/build/gradle/aar-metadata.properties").decode("utf-8")
        if "minCompileSdk=36" not in metadata:
            raise RuntimeError("AAR metadata must remain compatible with Android 36")

    temp.replace(target)
    print("AAR: {}".format(target))
    print("Bytes: {:,}".format(target.stat().st_size))
    print("Removed assets: {}".format(removed_assets))
    print("Removed JNI libraries: {}".format(removed_native))
    print("Kept core JNI libraries: {}".format(", ".join(sorted(kept_native))))


if __name__ == "__main__":
    main()
