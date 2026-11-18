"""Inventory provisioning profiles on macOS without exposing device identifiers."""
import datetime
import hashlib
import json
import pathlib
import plistlib
import subprocess
import sys

for path in pathlib.Path(sys.argv[1]).glob('*.mobileprovision'):
    raw = subprocess.check_output(['security', 'cms', '-D', '-i', str(path)])
    profile = plistlib.loads(raw)
    entitlements = profile.get('Entitlements', {})
    print(json.dumps({
        'file': path.name,
        'name': profile.get('Name'),
        'uuid': profile.get('UUID'),
        'team': profile.get('TeamIdentifier'),
        'applicationIdentifier': entitlements.get('application-identifier'),
        'debuggable': entitlements.get('get-task-allow', False),
        'expires': str(profile.get('ExpirationDate')),
        'expired': profile['ExpirationDate'] < datetime.datetime.utcnow(),
        'deviceCount': len(profile.get('ProvisionedDevices', [])),
        'allDevices': profile.get('ProvisionsAllDevices', False),
        'certificateSHA256': [hashlib.sha256(c).hexdigest() for c in profile.get('DeveloperCertificates', [])],
    }, ensure_ascii=False))
