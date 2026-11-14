"""Create a versioned Engine AAR with the uni-app page-open changes."""
from pathlib import Path
from zipfile import ZipFile
from shutil import copyfileobj
from copy import copy
import argparse


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default="0.1.3")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[2]
    base = repo / "sdk/central-release/staging-0.1.1/io/github/tmkmk/collabora/collabora-engine/0.1.1/collabora-engine-0.1.1.aar"
    classes = repo / "sdk/collabora-engine/build/classes-{}.jar".format(args.version)
    socket = repo / "sdk/collabora-engine/build/Socket-{}.js".format(args.version)
    output = repo / "sdk/collabora-engine/build/repo/org/libreoffice/collabora-engine/{}-poc/collabora-engine-{}-poc.aar".format(args.version, args.version)
    if not all(path.is_file() for path in (base, classes, socket)):
        raise FileNotFoundError("Base AAR or changed Engine files are missing")
    output.parent.mkdir(parents=True, exist_ok=True)
    replacements = {
        "classes.jar": classes,
        "assets/dist/src/app/Socket.js": socket,
    }
    with ZipFile(base) as source, ZipFile(output, "w") as target:
        for item in source.infolist():
            with target.open(copy(item), "w") as destination:
                if item.filename in replacements:
                    with replacements[item.filename].open("rb") as replacement:
                        copyfileobj(replacement, destination)
                else:
                    with source.open(item) as original:
                        copyfileobj(original, destination)
    print("{} {} bytes".format(output, output.stat().st_size))


if __name__ == "__main__":
    main()
