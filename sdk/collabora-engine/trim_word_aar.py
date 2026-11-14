from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

repo = Path(__file__).parent / 'build/repo/org/libreoffice'
source = repo / 'collabora-engine/0.1.0-poc/collabora-engine-0.1.0-poc.aar'
variant = repo / 'collabora-engine-word/0.1.0-poc'
target = variant / 'collabora-engine-word-0.1.0-poc.aar'
source_pom = repo / 'collabora-engine/0.1.0-poc/collabora-engine-0.1.0-poc.pom'
variant.mkdir(parents=True, exist_ok=True)
excluded = (
    'assets/share/gallery/',
    'assets/dist/videobackgrounds/',
    'assets/dist/templates/files/presentation/',
    'assets/dist/templates/files/spreadsheet/',
)
with ZipFile(source) as input_aar, ZipFile(target, 'w', ZIP_DEFLATED, compresslevel=9) as output_aar:
    for entry in input_aar.infolist():
        if any(entry.filename.startswith(prefix) for prefix in excluded):
            continue
        with input_aar.open(entry) as input_entry, output_aar.open(entry, 'w', force_zip64=True) as output_entry:
            while chunk := input_entry.read(1024 * 1024):
                output_entry.write(chunk)

pom = source_pom.read_text(encoding='utf-8-sig').replace(
    '<artifactId>collabora-engine</artifactId>',
    '<artifactId>collabora-engine-word</artifactId>',
)
(variant / 'collabora-engine-word-0.1.0-poc.pom').write_text(pom, encoding='utf-8')

print(f'Source: {source.stat().st_size:,} bytes')
print(f'Word-only: {target.stat().st_size:,} bytes')
with ZipFile(target) as aar:
    names = aar.namelist()
    assert 'jni/arm64-v8a/liblo-native-code.so' in names
    assert 'assets/templates/untitled.docx' in names
    assert not any(name.startswith(prefix) for name in names for prefix in excluded)
print(f'Entries: {len(names):,}; required DOCX template and native engine verified')
