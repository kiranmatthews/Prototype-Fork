"""Record a completed trial after native, browser and manual image review."""
import datetime
import json
import re
import shutil
import sys
from pathlib import Path

trial_id, started, notes = int(sys.argv[1]), sys.argv[2], sys.argv[3]
source = Path(f'/workspace/crystal-trials/{trial_id:02}')
trial = json.loads((source / 'layout.json').read_text())
for filename in ('native.json', 'browser-lite.json', 'browser-full.json'):
    report = json.loads((source / filename).read_text())
    assert report.get('passed') and not report.get('errors'), (filename, report.get('failure'))
root = Path('docs/crystal-trials')
slug = f'{trial_id:02}'
destination = root / slug
destination.mkdir(exist_ok=True)
for filename in ('native.json', 'browser-lite.json', 'browser-full.json'):
    shutil.copy2(source / filename, destination / filename)
for picture in source.glob('full-*.png'):
    shutil.copy2(picture, destination / picture.name)
rejects = json.loads(Path('src/levels/crystal-trials/rejects.ts').read_text().split(' = ', 1)[1].strip().removesuffix(';'))
now = datetime.datetime.now(datetime.timezone.utc)
elapsed = (now - datetime.datetime.fromisoformat(started.replace('Z', '+00:00'))).total_seconds() / 60
p = root / 'progress.json'
progress = json.loads(p.read_text())
assert all(c['id'] != trial_id for c in progress['completed']), 'Already recorded; update the existing entry deliberately.'
progress['completed'].append(dict(id=trial_id, name=trial['name'], geometry_started_at=started,
    validated_at=now.isoformat(), evidence=slug, rejects=[r['attempt'] for r in rejects if r['id'] == trial_id]))
progress.update(validated=len(progress['completed']), current=trial_id + 1, rejected_attempts=len(rejects))
p.write_text(json.dumps(progress, indent=2) + '\n')
p = root / 'README.md'
text = re.sub(r'\*\*\d+/25 challenges validated locally\.\*\*', f"**{progress['validated']}/25 challenges validated locally.**", p.read_text())
text = re.sub(r'The remaining \d+ challenges', f"The remaining {25-progress['validated']} challenges", text)
p.write_text(text)
with Path('docs/LEVEL_ITERATIONS.md').open('a') as f:
    f.write(f"\n### {now.date()} — Crystal Trials {trial_id:02}: {trial['name']}\n\n")
    f.write(f"Retrieval {trial_id}, reviewed in {elapsed:.1f} minutes from {started}. {notes} ")
    f.write(f"Native and lite Chromium controller routes pass with clean browser consoles; full-render, full-resolution views were manually inspected. Movement settings remain unchanged. [Evidence](crystal-trials/{slug}/).\n")
print(f'Recorded {trial_id:02} / {trial["name"]}: {elapsed:.1f} minutes, {progress["validated"]}/25 validated.')
