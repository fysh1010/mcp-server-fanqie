"""Build source/Skill ZIPs and checksums; release tooling only, not a runtime dependency."""
import argparse
import hashlib
import pathlib
import zipfile

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    root = pathlib.Path(__file__).resolve().parent.parent
    import json
    version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
    output = pathlib.Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    source = output / f'fanqie-mcp-skills-{version}-source.zip'
    skill = output / f'fanqie-novel-skill-{version}.zip'
    names = ['package.json', 'package-lock.json', 'tsconfig.json', 'README.md', 'LICENSE', '.gitignore', 'THIRD_PARTY_NOTICES.md']
    files = [root / name for name in names]
    for folder in ['src', 'build', 'server', 'scripts', 'skills', 'docs', 'licenses']:
        files.extend(p for p in (root / folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
    with zipfile.ZipFile(source, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(files):
            archive.write(path, pathlib.Path('mcp-server-fanqie') / path.relative_to(root))
    skill_root = root / 'skills' / 'fanqie-novel'
    with zipfile.ZipFile(skill, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(skill_root.rglob('*')):
            if path.is_file():
                archive.write(path, pathlib.Path('fanqie-novel') / path.relative_to(skill_root))
    artifacts = [source, skill]
    tarball = output / f'fysh925-mcp-server-fanqie-{version}.tgz'
    if tarball.is_file():
        artifacts.append(tarball)
    checksums = ''.join(f'{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n' for path in artifacts)
    (output / 'SHA256SUMS.txt').write_text(checksums, encoding='utf-8')
    for path in artifacts:
        print(f'{path.name}: {path.stat().st_size} bytes')

if __name__ == '__main__':
    main()
