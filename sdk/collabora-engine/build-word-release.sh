#!/bin/bash
set -euo pipefail
source /opt/rh/gcc-toolset-12/enable
cd /src/online/engine
out=/opt/collabora-toolchain/word-only
cp -n autogen.input "$out/autogen.input.debug-baseline"
cp -n config_host.mk "$out/config_host.mk.debug-baseline"
if [ ! -f "$out/liblo-native-code.full-debug.so" ]; then
    cp android/jniLibs/arm64-v8a/liblo-native-code.so "$out/liblo-native-code.full-debug.so"
fi
sed '/--enable-dbgutil/d; /--enable-sal-log/d' "$out/autogen.input.debug-baseline" > autogen.input
printf '%s\n' --disable-dbgutil --disable-debug --disable-symbols --enable-optimized >> autogen.input
./autogen.sh
make clean
make -j12 PARALLELISM=12 LOADLIMIT=12 gb_COMPILEROPTFLAGS=-Oz
bash /opt/collabora-toolchain/word-only/relink-word.sh
python3.11 /opt/collabora-toolchain/word-only/package-native-word.py
