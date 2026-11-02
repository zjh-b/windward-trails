"""Validate and package the standalone game, excluding raw Blender exports."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
from urllib.request import urlopen
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent
ARCHIVE = ROOT.parent / 'windward_trails_game_v4_3.zip'
THEMES = ['grassland', 'forest', 'alpine', 'lagoon', 'desert', 'cavern']


def main():
    browser = json.loads((ROOT / 'qa/browser-verification.json').read_text(encoding='utf-8'))
    assert browser['passed'] and not browser['console_errors'], 'Run browser QA first.'
    assert not browser.get('contract_only'), 'Full browser QA is required.'
    assert len([check for check in browser['checks'] if isinstance(check, dict) and 'keyboard_completed_stage' in check]) == 6, 'Verify all six stages before packaging.'
    assert not browser.get('resource_errors'), 'Browser resource loading failed.'
    traps = json.loads((ROOT / 'qa/traps-verification.json').read_text(encoding='utf-8'))
    assert traps['passed'] and len(traps['checks']) == 2, 'Verify swamp and quicksand in the browser.'
    presentation=json.loads((ROOT/'qa/presentation-verification.json').read_text(encoding='utf-8'))
    assert presentation['passed'] and not presentation['console_errors'], 'Run presentation QA first.'
    orientation=json.loads((ROOT/'qa/orientation-verification.json').read_text(encoding='utf-8'))
    assert orientation['passed'] and not orientation['console_errors'], 'Run portrait-to-landscape QA first.'
    audio=json.loads((ROOT/'qa/audio-browser-verification.json').read_text(encoding='utf-8'))
    assert audio['passed'] and not audio['console_errors'] and not audio['resource_errors'], 'Run audio browser QA first.'
    items=json.loads((ROOT/'qa/items-verification.json').read_text(encoding='utf-8'))
    assert items['passed'] and not items['console_errors'] and not items['resource_errors'], 'Run random block and item HUD browser QA first.'
    quality=json.loads((ROOT/'qa/audio-quality.json').read_text(encoding='utf-8'))
    for theme in THEMES:
        track = quality['after'][theme]
        assert track['finite'] and track['decoded_seconds'] == 40 and track['channels'] == 2, theme
        assert track['true_peak_dbfs'] < -1 and track['integrated_lufs'] < -24, theme
        assert track['sha256'] == hashlib.sha256((ROOT/f'assets/{theme}.mp3').read_bytes()).hexdigest(), f'Rerun audio quality QA for {theme}'
    sources = ['index.html', 'style.css', 'combat.js', 'items.js', 'core.js', 'scenery.js', 'finale.js', 'item-art.js', 'game.js', 'assets/sprites.js']
    sources += [f'assets/{theme}.mp3' for theme in THEMES]
    for name in sources:
        actual = hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
        assert browser.get('source_sha256', {}).get(name) == actual, f'Rerun browser QA after changing {name}'
        assert traps.get('source_sha256', {}).get(name) == actual, f'Rerun trap QA after changing {name}'
        assert presentation.get('source_sha256', {}).get(name) == actual, f'Rerun presentation QA after changing {name}'
        assert orientation.get('source_sha256', {}).get(name) == actual, f'Rerun orientation QA after changing {name}'
        assert audio.get('source_sha256', {}).get(name) == actual, f'Rerun audio browser QA after changing {name}'
        assert items.get('source_sha256', {}).get(name) == actual, f'Rerun item browser QA after changing {name}'
    for name in ['combat.js', 'items.js', 'core.js', 'scenery.js', 'finale.js', 'item-art.js', 'game.js', 'assets/sprites.js']:
        subprocess.run(['node', '--check', name], cwd=ROOT, check=True, capture_output=True)
    core = subprocess.run(['node', '--test', 'tests/core.test.cjs', 'tests/combat.test.cjs', 'tests/presentation.test.cjs', 'tests/items.test.cjs'], cwd=ROOT,
                          check=True, capture_output=True, encoding='utf-8')
    required = ['index.html', 'style.css', 'combat.js', 'items.js', 'core.js', 'scenery.js', 'finale.js', 'item-art.js', 'game.js', 'run_game.py',
                'assets/hero.png', 'assets/ranger.png', 'assets/mage.png', 'assets/cat.png', 'assets/sprites.js']
    for theme in THEMES:
        required.extend([f'assets/bg-{theme}.jpg', f'assets/{theme}.mp3'])
    required.extend(['assets/audio-attribution.md', 'tools/render_ambience.py'])
    for name in required:
        assert (ROOT / name).is_file() and (ROOT / name).stat().st_size > 0, name
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    for ref in re.findall(r'(?:src|href)="([^"]+)"', html):
        if not ref.startswith('data:'):
            assert '://' not in ref and (ROOT / ref).is_file(), ref

    # Exercise the optional Python launcher without opening a visible window.
    server = subprocess.Popen([sys.executable, '-u', str(ROOT / 'run_game.py'), '--no-browser'],
                              cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                              text=True, encoding='utf-8')
    try:
        line = server.stdout.readline().strip()
        url = line.split('Windward Trails: ', 1)[1]
        with urlopen(url, timeout=5) as response:
            assert response.status == 200
            assert '风野奇旅' in response.read().decode('utf-8')
        with urlopen(url + 'assets/hero.png', timeout=5) as response:
            assert response.status == 200 and response.read(8) == b'\x89PNG\r\n\x1a\n'
    finally:
        server.terminate()
        server.wait(timeout=5)

    top = ['index.html', 'style.css', 'combat.js', 'items.js', 'core.js', 'scenery.js', 'finale.js', 'item-art.js', 'game.js', 'README.md', 'DESIGN.md', 'IMPROVEMENTS.md',
           'PLAN.md', 'run_game.py', 'Start Game.cmd', 'export_assets.py',
           'pack_assets.py', 'package_game.py', 'EXPANSION.md', 'export_expansion.py', 'pack_expansion.py',
           '.gitignore', '.nojekyll']
    files = [ROOT / name for name in top]
    files += sorted(p for p in (ROOT / 'assets').iterdir() if p.is_file())
    files += sorted(p for p in (ROOT / 'tests').iterdir() if p.is_file())
    files += sorted((ROOT / 'tools').glob('*.py'))
    files += sorted((ROOT / 'docs').rglob('*.md'))
    files += sorted(p for p in (ROOT / 'qa').iterdir()
                    if p.is_file() and p.name not in ['verification.json', 'contract-verification.json']
                    and not p.name.startswith('failure-') and '-precheck' not in p.name
                    and p.suffix in ['.png', '.json'])
    report = {
        'verified_at_utc': datetime.now(timezone.utc).isoformat(),
        'passed': True,
        'core_tests': core.stdout,
        'javascript_syntax': 'passed',
        'python_launcher_http_and_asset': 'passed',
        'browser': browser,
        'presentation': presentation,
        'orientation': orientation,
        'audio': audio,
        'items': items,
        'audio_quality': quality,
        'archive': ARCHIVE.name,
        'sha256': {str(p.relative_to(ROOT)).replace('\\', '/'): hashlib.sha256(p.read_bytes()).hexdigest()
                   for p in files},
    }
    verification = ROOT / 'qa/verification.json'
    verification.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    files.append(verification)
    with ZipFile(ARCHIVE, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            archive.write(path, 'stroll_game/' + path.relative_to(ROOT).as_posix())
    with ZipFile(ARCHIVE) as archive:
        assert archive.testzip() is None
        assert len(archive.namelist()) == len(files)
        for path in files:
            assert archive.read('stroll_game/' + path.relative_to(ROOT).as_posix()) == path.read_bytes()
    print(json.dumps({'passed': True, 'archive': str(ARCHIVE), 'files': len(files),
                      'size_mb': round(ARCHIVE.stat().st_size / 1024**2, 2),
                      'crc_and_contents': 'passed'}, ensure_ascii=False))


if __name__ == '__main__':
    main()
