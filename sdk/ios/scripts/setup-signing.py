"""Import authorized P12 files into an isolated macOS build keychain.

Read the P12 password from stdin; never store it in this script or print it.
The generated keychain password is stored only in a mode-0600 remote file.
"""
import os
import pathlib
import plistlib
import secrets
import subprocess
import sys
import tempfile

root = pathlib.Path.home() / 'collabora-build/signing'
keychain = root / 'collabora-build.keychain-db'
password_file = root / 'keychain-password'
p12_password = sys.stdin.readline().lstrip('\ufeff').rstrip('\r\n')
os.umask(0o077)
if not password_file.exists():
    password_file.write_text(secrets.token_urlsafe(40))
password = password_file.read_text()

def run(*args):
    result = subprocess.run(['security', *map(str, args)], capture_output=True)
    if result.returncode:
        # Do not expose command arguments containing credentials.
        raise RuntimeError('security operation failed: ' + str(args[0]) + ': ' + result.stderr.decode(errors='replace'))
    return result.stdout

if not keychain.exists():
    run('create-keychain', '-p', password, keychain)
run('unlock-keychain', '-p', password, keychain)
run('set-keychain-settings', '-lut', '21600', keychain)
for filename in ('ios_development.p12', 'ios_distribution.p12'):
    # macOS security may reject newer PKCS12 encryption despite a valid password.
    # Re-encode using a private temporary directory, removed immediately.
    environment = dict(os.environ, COLLABORA_P12_PASSWORD=p12_password)
    openssl = '/opt/homebrew/opt/openssl@3/bin/openssl'
    decoded = subprocess.run([openssl, 'pkcs12', '-in', str(root / filename),
                              '-passin', 'env:COLLABORA_P12_PASSWORD', '-nodes'],
                             env=environment, capture_output=True, check=True).stdout
    compatible = root / (filename + '.mac-compatible.p12')
    with tempfile.TemporaryDirectory(dir=root) as temporary:
        pem = pathlib.Path(temporary) / 'identity.pem'
        pem.write_bytes(decoded)
        converted = subprocess.run([openssl, 'pkcs12', '-export', '-in', str(pem),
                        '-keypbe', 'PBE-SHA1-3DES', '-certpbe', 'PBE-SHA1-3DES',
                        '-macalg', 'sha1', '-out', str(compatible),
                        '-passout', 'env:COLLABORA_P12_PASSWORD'],
                       env=environment, capture_output=True)
    if converted.returncode:
        raise RuntimeError(converted.stderr.decode(errors='replace'))
    del decoded
    run('import', compatible, '-k', keychain, '-P', p12_password,
        '-T', '/usr/bin/codesign', '-T', '/usr/bin/security')
run('set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-s', '-k', password, keychain)
# Preserve the existing user's search list and default keychain.
existing = run('list-keychains', '-d', 'user').decode().splitlines()
paths = [line.strip().strip('"') for line in existing if line.strip()]
if str(keychain) not in paths:
    run('list-keychains', '-d', 'user', '-s', *paths, keychain)
for profile in root.glob('*.mobileprovision'):
    content = run('cms', '-D', '-i', profile)
    identifier = plistlib.loads(content)['UUID']
    for folder in ('Library/MobileDevice/Provisioning Profiles', 'Library/Developer/Xcode/UserData/Provisioning Profiles'):
        target = pathlib.Path.home() / folder
        target.mkdir(parents=True, exist_ok=True)
        destination = target / (identifier + '.mobileprovision')
        if destination.exists() and destination.read_bytes() != profile.read_bytes():
            raise RuntimeError('Existing profile differs; preserved: ' + str(destination))
        destination.write_bytes(profile.read_bytes())
print(run('find-identity', '-v', '-p', 'codesigning', keychain).decode())
