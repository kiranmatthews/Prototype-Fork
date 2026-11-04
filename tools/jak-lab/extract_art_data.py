#!/usr/bin/env python3
"""Disassemble all source art groups without re-exporting levels or textures.

Run under the shared heavy-job guard. Inputs remain read-only; the output is
local game-derived data and must stay outside Git and public/.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import struct
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['installation', 'game-data', 'output']:
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    installation, game, output = args.installation.resolve(), args.game_data.resolve(), args.output.resolve()
    if not (game / 'SCUS_971.24').is_file():
        raise ValueError('Expected the supplied USA SCUS-97124 game data')
    project = output / 'opengoal'
    if not project.exists():
        shutil.copytree(installation / 'data', project)
    groups = json.loads((project / 'decompiler/config/jak1/ntsc_v1/art-group-info.min.json').read_text())
    config = {'inputs_file': 'decompiler/config/jak1/ntsc_v1/inputs.jsonc', 'allowed_objects': sorted(groups),
              'banned_objects': [], 'dump_objs': True, 'disassemble_data': True,
              'disassemble_code': False, 'decompile_code': False, 'find_functions': False,
              'levels_extract': False, 'rip_levels': False, 'process_tpages': False,
              'process_game_text': False, 'process_game_count': False, 'process_part_group_table': False,
              'process_art_groups': False, 'save_texture_pngs': False, 'extract_collision': False,
              'dump_art_group_info': False, 'dump_joint_geo_info': False, 'dump_tex_info': False,
              'dump_part_group_table': False}
    (output / 'art-extraction-config.json').write_text(json.dumps(config, indent=2) + '\n')
    command = [str(installation / 'extractor'), '--proj-path', str(project), '--folder', str(game),
               '--decompile', '--disable-ansi', '--decomp-config-override', json.dumps(config)]
    with (output / 'art-extraction.log').open('w') as log:
        subprocess.run(command, cwd=output, stdout=log, stderr=subprocess.STDOUT, check=True)
    source = project / 'decompiler_out/jak1'
    records = {}
    for group in sorted(groups):
        raw = (source / 'raw_obj' / (group + '.go')).read_bytes()
        assembly = (source / (group + '.asm')).read_bytes()
        records[group] = {'rawSha256': hashlib.sha256(raw).hexdigest(), 'rawBytes': len(raw),
                          'assemblySha256': hashlib.sha256(assembly).hexdigest(), 'assemblyBytes': len(assembly),
                          'archives': []}
    by_hash = {r['rawSha256']: r for r in records.values()}
    for archive in sorted([*(game / 'CGO').glob('*.CGO'), *(game / 'DGO').glob('*.DGO')]):
        data = archive.read_bytes()
        count, = struct.unpack_from('<I', data)
        if count > 10000:
            raise ValueError('Unexpected archive format: ' + str(archive))
        at = 64
        for _ in range(count):
            size, = struct.unpack_from('<I', data, at)
            name = data[at + 4:at + 64].split(b'\0')[0].decode()
            at += 64
            blob = data[at:at + size]
            if len(blob) != size:
                raise ValueError('Truncated source archive')
            digest = hashlib.sha256(blob).hexdigest()
            if digest in by_hash:
                by_hash[digest]['archives'].append({'path': str(archive.relative_to(game)), 'object': name, 'offset': at})
            at += (size + 15) // 16 * 16
    if any(not r['archives'] for r in records.values()):
        raise ValueError('A disassembled object does not match the supplied archive bytes')
    (output / 'art-extraction-manifest.json').write_text(json.dumps(records, indent=2) + '\n')
    print(json.dumps({'artGroups': len(records), 'rawObjectsVerifiedAgainstSuppliedArchives': len(records),
                      'assemblyBytes': sum(r['assemblyBytes'] for r in records.values())}))


if __name__ == '__main__':
    main()
