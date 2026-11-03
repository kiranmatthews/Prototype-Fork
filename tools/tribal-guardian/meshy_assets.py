#!/usr/bin/env python3
"""Tribal guardian jobs, using the shared official-CLI submission journal."""
import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('enemy_meshy', HERE.parent / 'enemies/meshy_assets.py')
jobs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(jobs)
jobs.HERE = HERE
jobs.WORK = jobs.ROOT / '.img2threejs/tribal-guardian'
jobs.LEDGER = HERE / 'tasks.json'
if __name__ == '__main__':
    jobs.main()
