"""Build the isolated SDK probe with its signing keychain explicitly unlocked."""
from pathlib import Path
import subprocess
import sys

root = Path.home() / 'collabora-build'
signing = root / 'signing'
configuration = sys.argv[1] if len(sys.argv) > 1 else 'Debug'
if configuration not in ('Debug', 'Release'):
    raise SystemExit('Expected Debug or Release')
subprocess.run(['security', 'unlock-keychain', '-p', (signing / 'keychain-password').read_text(),
                str(signing / 'collabora-build.keychain-db')], check=True, capture_output=True)
with (root / 'logs' / ('sdk-host-signed-' + configuration + '.log')).open('w') as log:
    result = subprocess.run(['xcodebuild', '-workspace', str(root / 'ios-sdk-host/HBuilder-Hello/HBuilder-Hello.xcworkspace'),
                             '-scheme', 'HBuilder', '-configuration', configuration, '-sdk', 'iphoneos',
                             '-derivedDataPath', str(root / 'DerivedData'), 'build'], stdout=log, stderr=subprocess.STDOUT)
print(configuration, 'build exit:', result.returncode)
raise SystemExit(result.returncode)
