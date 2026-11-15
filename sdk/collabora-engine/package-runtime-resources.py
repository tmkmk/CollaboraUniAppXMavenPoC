"""Build the versioned runtime resource bundle from the published Engine AAR."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from shutil import copyfileobj
from zipfile import ZIP_DEFLATED, ZipFile


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
    parser.add_argument(
        "--include-core-native",
        action="store_true",
        help="include libandroidapp.so and libc++_shared.so (normally remain in the app)",
    )
    args = parser.parse_args()

    aar = repo / "sdk/collabora-engine/build/repo/org/libreoffice/collabora-engine/{0}-poc/collabora-engine-{0}-poc.aar".format(args.version)
    output_dir = repo / "build/runtime-resources" / args.version
    output_dir.mkdir(parents=True, exist_ok=True)
    bundle = output_dir / "collabora-engine-runtime-{0}-{1}.zip".format(args.version, args.abi)
    inventory: list[dict[str, object]] = []
    core_native = {"libandroidapp.so", "libc++_shared.so"}

    if not aar.is_file():
        raise FileNotFoundError("Engine AAR not found: {}".format(aar))

    with ZipFile(aar) as source, ZipFile(bundle, "w", ZIP_DEFLATED, compresslevel=6, allowZip64=True) as target:
        for item in source.infolist():
            is_asset = item.filename.startswith("assets/") and not item.is_dir()
            is_native = (
                item.filename.startswith("jni/{}/".format(args.abi))
                and item.filename.endswith(".so")
                and (args.include_core_native or Path(item.filename).name not in core_native)
            )
            if not (is_asset or is_native):
                continue
            with source.open(item) as data:
                digest, size = sha256_stream(data)
                data.seek(0)
                with target.open(item.filename, "w") as output:
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


if __name__ == "__main__":
    main()
