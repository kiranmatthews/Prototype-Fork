#!/usr/bin/env python3
"""Export the supplied Jak 1 data with the official local OpenGOAL extractor.

The source installation is
read-only; all generated originals and extraction configuration stay in output.
"""
import argparse
import json
from pathlib import Path
import shutil
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--installation', type=Path, required=True)
    data = parser.add_mutually_exclusive_group(required=True)
    data.add_argument('--game-data', type=Path)
    data.add_argument('--iso', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    installation, output = args.installation.resolve(), args.output.resolve()
    game = args.game_data.resolve() if args.game_data else None
    if game and not (game / 'SCUS_971.24').is_file():
        raise SystemExit('Expected the supplied USA SCUS-97124 game-data directory')
    project = output / 'opengoal'
    output.mkdir(parents=True, exist_ok=True)
    if not project.exists():
        shutil.copytree(installation / 'data', project,
                        ignore=shutil.ignore_patterns('decompiler_out', 'out', 'logs'))
    config = {
        'inputs_file': 'decompiler/config/jak1/ntsc_v1/inputs.jsonc',
        'allowed_objects': [], 'banned_objects': [],
        'rip_levels': True, 'save_texture_pngs': True,
        'dump_objs': False, 'find_functions': False,
        'process_game_text': False, 'process_game_count': False,
        'process_part_group_table': False, 'extract_collision': False,
        # Metadata tables ship with this pinned source. The optional dump
        # switches require code decompilation and are unrelated to GLB export.
        'dump_art_group_info': False, 'dump_joint_geo_info': False,
        'dump_tex_info': False, 'dump_part_group_table': False,
    }
    (output / 'extraction-config.json').write_text(json.dumps(config, indent=2) + '\n')
    command = [str(installation / 'extractor'), '--proj-path', str(project),
               '--decompile', '--disable-ansi', '--decomp-config-override', json.dumps(config)]
    if game:
        command += ['--folder', str(game)]
    else:
        iso = args.iso.resolve()
        if not iso.is_file():
            raise SystemExit('The supplied ISO does not exist')
        command += ['--extract', '--validate', '--extract-path', str(output / 'iso-data'), str(iso)]
    print('Exporting all configured Jak 1 archives to', project, flush=True)
    with (output / 'extraction.log').open('w') as log:
        result = subprocess.run(command, cwd=output, stdout=log, stderr=subprocess.STDOUT)
    print('Extractor exit:', result.returncode, 'Log:', output / 'extraction.log', flush=True)
    raise SystemExit(result.returncode)


if __name__ == '__main__':
    main()
