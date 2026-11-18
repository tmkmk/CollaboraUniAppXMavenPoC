"""Apply user-confirmed SDK metadata and AppKey to the isolated host only."""
import json
from pathlib import Path
import plistlib

root = Path.home() / 'collabora-build'
config = json.loads((root / 'signing/host-config.json').read_text())
sdk = root / 'ios-sdk-host'
podspec = sdk / 'uniapp.podspec'
content = podspec.read_text()
old = "s.version = '5.33.0'"
new = "s.version = '" + config['sdkPodVersion'] + "'"
if old not in content and new not in content:
    raise SystemExit('Unexpected podspec version; inspect before changing.')
backup = podspec.with_suffix('.podspec.before-version-correction')
if not backup.exists():
    backup.write_bytes(podspec.read_bytes())
podspec.write_text(content.replace(old, new, 1))
info = sdk / 'HBuilder-Hello/HBuilder-Hello/HBuilder-Hello-Info.plist'
data = plistlib.loads(info.read_bytes())
data['dcloud_appkey'] = config['iosAppKey']
info.write_bytes(plistlib.dumps(data, sort_keys=False))
print('Pod metadata corrected to', config['sdkPodVersion'], '; iOS AppKey configured.')
print('SDK binaries unchanged. AppID/resources remain pending business resource export.')
