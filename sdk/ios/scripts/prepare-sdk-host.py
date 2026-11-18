"""Create an isolated SDK build probe; never modify downloaded SDK originals."""
from pathlib import Path
import shutil
import re
import subprocess

source = Path.home() / 'Downloads/SDK'
target = Path.home() / 'collabora-build/ios-sdk-host'
if target.exists():
    raise SystemExit('Host already exists; inspect it instead of overwriting.')
shutil.copytree(source, target)
project = target / 'HBuilder-Hello'
podfile = project / 'Podfile'
content = podfile.read_text()
content = re.sub(r"^source .*\n", '', content, flags=re.M)
content = re.sub(r'uniapp_subspecs = \[.*?\n\]',
                 "uniapp_subspecs = ['Core', 'File', 'XMLHttpRequest', 'Zip', 'Log']",
                 content, count=1, flags=re.S)
podfile.write_text(content)
print('Prepared isolated minimal SDK host:', project)
result = subprocess.run(['/opt/homebrew/bin/pod', 'install', '--no-repo-update'], cwd=project)
raise SystemExit(result.returncode)
