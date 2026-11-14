"""Generate version-matched Engine asset overrides used by the uni-app x demo.

Only scripts with class static blocks are transformed. Native libraries and the
published AAR stay unchanged. Run again when intentionally changing the AAR.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile


def main():
    repo = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--esbuild-module', default=
                        'D:/soft/HBuilderX/plugins/uniapp-cli-vite/node_modules/esbuild')
    parser.add_argument('--version', default='0.1.1')
    args = parser.parse_args()
    aar = repo / ('sdk/collabora-engine/build/repo/org/libreoffice/'
                  'collabora-engine/{}-poc/collabora-engine-{}-poc.aar'.format(
                      args.version, args.version))
    output = repo / 'uniappx-demo/nativeResources/android/assets'
    jobs = []
    with zipfile.ZipFile(aar) as archive:
        for name in sorted(archive.namelist()):
            if not name.startswith('assets/dist/') or not name.endswith('.js'):
                continue
            source = archive.read(name).decode('utf-8')
            if 'static {' not in source:
                continue
            relative = Path(name[7:])
            if '..' in relative.parts:
                raise ValueError('Unsafe asset path: ' + name)
            jobs.append({'source': source, 'output': str(output / relative),
                         'name': name})
    if not jobs:
        raise RuntimeError('No static blocks found; verify the input AAR version.')
    transform = r'''
const fs = require('fs');
const path = require('path');
const esbuild = require(process.argv[1]);
if (esbuild.version !== '0.20.1') throw new Error('Expected esbuild 0.20.1');
const jobs = JSON.parse(fs.readFileSync(0, 'utf8'));
for (const job of jobs) {
    const result = esbuild.transformSync(job.source, {
        target: 'chrome87', legalComments: 'inline', sourcefile: job.name
    });
    fs.mkdirSync(path.dirname(job.output), {recursive: true});
    fs.writeFileSync(job.output, result.code);
}
'''
    subprocess.run(['node', '-e', transform, args.esbuild_module],
                   input=json.dumps(jobs), text=True, encoding='utf-8', check=True)
    report = {
        'engine': 'io.github.tmkmk.collabora:collabora-engine:{}'.format(args.version),
        'aarSha256': hashlib.sha256(aar.read_bytes()).hexdigest(),
        'esbuild': '0.20.1', 'target': 'chrome87',
        'files': {job['name']: hashlib.sha256(Path(job['output']).read_bytes()).hexdigest()
                  for job in jobs}
    }
    (Path(__file__).parent / 'webview-compat-assets.json').write_text(
        json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print('Generated {} asset overrides in {}'.format(len(jobs), output))


if __name__ == '__main__':
    main()
