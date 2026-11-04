"""Recover explicit part-tracker launch timing, without inventing host logic.

Only launches with a literal group/duration and no custom callback, userdata or
tracked target become replay recipes. Every other call remains source evidence.
"""
from __future__ import annotations

import hashlib
import json
import math


def tracker_launch(form, source, groups):
    """Return a source record, with a replay only for fully known timing inputs."""
    if not isinstance(form, list) or not form:
        return None
    args = None
    if form[0] == 'process-spawn' and len(form) > 2 and form[1] == 'part-tracker':
        rest, keywords, i = [], {}, 2
        while i < len(form):
            item = form[i]
            if isinstance(item, str) and item.startswith(':'):
                if item not in (':init', ':from', ':to', ':name', ':stack-size', ':stack') or i + 1 == len(form):
                    return {'source': source, 'form': form, 'unsupported': 'Unknown process-spawn keyword'}
                keywords[item] = form[i + 1]
                i += 2
            else:
                rest.append(item)
                i += 1
        if keywords.get(':init') == 'part-tracker-init':
            args = rest
    elif form[0] == 'run-now-in-process' and len(form) > 2 and form[2] == 'part-tracker-init':
        args = form[3:]
    elif form[0] == 'part-tracker-init':
        args = form[1:]
    if args is None:
        return None
    record = {'source': source, 'form': form}
    if len(args) != 6:
        return {**record, 'unsupported': 'Different initializer arguments'}
    name, duration, callback, userdata, target, position = args
    record.update(group=name, duration=duration, callback=callback, userdata=userdata,
                  target=target, position=position)
    if not isinstance(name, str) or name not in groups:
        return {**record, 'unsupported': 'Computed or undefined group'}
    if not isinstance(duration, (int, float)) or not math.isfinite(duration):
        return {**record, 'unsupported': 'Computed duration'}
    if (callback, userdata, target) != ('#f', '#f', '#f'):
        return {**record, 'unsupported': 'Custom callback, userdata or tracked target'}
    group = groups[name]
    duration = duration if duration > 0 else group['duration']
    linger = group['linger-duration']
    if not all(isinstance(t, (int, float)) and math.isfinite(t) for t in (duration, linger)):
        return {**record, 'unsupported': 'Unresolved group timing'}
    record['replay'] = {
        'kind': 'part-tracker', 'group': name, 'duration': duration, 'linger': linger,
        'source': source,
        'formSha256': hashlib.sha256(json.dumps(form, separators=(',', ':')).encode()).hexdigest(),
    }
    return record
