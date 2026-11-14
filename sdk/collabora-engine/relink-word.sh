#!/bin/bash
set -euo pipefail
source /opt/rh/gcc-toolset-12/enable
cd /src/online/engine
out=/opt/collabora-toolchain/word-only
mkdir -p "$out/obj" "$out/jni"
cd "$out"
/src/online/engine/solenv/bin/native-code.py -j -g core -g writer -g edit > native-code.cxx
printf 'gb_Side:=host\ninclude /src/online/engine/config_host.mk\nexport BUILDDIR=/src/online/engine\nexport INSTDIR=/src/online/engine/instdir\nexport WORKDIR=/src/online/engine/workdir\ninclude /src/online/engine/android/source/Makefile\n' > "$out/Makefile"
export INSTDIR=/src/online/engine/instdir WORKDIR=/src/online/engine/workdir OS=ANDROID LIBO_LIB_FOLDER=program
printf '\n.EXPORT_ALL_VARIABLES:\nword-libs:\n\t$(SRCDIR)/bin/lo-all-static-libs > /opt/collabora-toolchain/word-only/libs.txt\n' >> "$out/Makefile"
make -f "$out/Makefile" gb_UnpackedTarball_workdir=/src/online/engine/workdir/UnpackedTarball word-libs
make -f "$out/Makefile" gb_UnpackedTarball_workdir=/src/online/engine/workdir/UnpackedTarball ALL_STATIC_LIBS="$(cat "$out/libs.txt")" OBJLOCAL="$out/obj" SODEST="$out/jni" link-so
stat -c '%n %s' "$out/jni/liblo-native-code.so"
