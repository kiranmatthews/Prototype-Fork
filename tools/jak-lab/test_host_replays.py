import unittest

from host_replays import tracker_launch


class HostReplayTests(unittest.TestCase):
    source = {'file': 'objects.gc', 'line': 10, 'function': 'state:die:crate'}
    groups = {'group-explode': {'duration': 300, 'linger-duration': 1500}}

    def launch(self, *args):
        return tracker_launch(['process-spawn', 'part-tracker', ':init', 'part-tracker-init',
                               *args, ':to', '*entity-pool*'], self.source, self.groups)

    def test_duration_override_and_group_fallback(self):
        for value, expected in [(-1, 300), (0, 300), (25, 25)]:
            recipe = self.launch('group-explode', value, '#f', '#f', '#f', ['->', 'self', 'root', 'trans'])['replay']
            self.assertEqual((recipe['duration'], recipe['linger']), (expected, 1500))
            self.assertEqual(recipe['source'], self.source)
            self.assertEqual(len(recipe['formSha256']), 64)

    def test_run_now_and_process_keywords_keep_argument_order(self):
        args = ['group-explode', 50, '#f', '#f', '#f', 'position']
        a = tracker_launch(['run-now-in-process', 'process', 'part-tracker-init', *args], self.source, self.groups)
        b = tracker_launch(['process-spawn', 'part-tracker', ':from', 'pool', ':init', 'part-tracker-init',
                            ':stack-size', 16384, *args], self.source, self.groups)
        self.assertEqual(a['replay']['duration'], b['replay']['duration'])
        self.assertEqual(a['position'], 'position')

    def test_host_dependencies_are_evidence_not_silent_replays(self):
        for args in [
            ['group-explode', ['->', 'self', 'duration'], '#f', '#f', '#f', 'position'],
            ['computed-group', -1, '#f', '#f', '#f', 'position'],
            ['group-explode', -1, 'update-source', '#f', '#f', 'position'],
            ['group-explode', -1, '#f', 'normal', '#f', 'position'],
            ['group-explode', -1, '#f', '#f', '*target*', 'position'],
        ]:
            record = self.launch(*args)
            self.assertIn('unsupported', record)
            self.assertNotIn('replay', record)
            self.assertEqual(record['source'], self.source)

    def test_unknown_keyword_and_argument_count_fail_closed(self):
        record = tracker_launch(['process-spawn', 'part-tracker', ':new-behavior', True], self.source, self.groups)
        self.assertIn('unsupported', record)
        self.assertIn('unsupported', self.launch('group-explode', -1))
        self.assertIsNone(tracker_launch(['unrelated', 'part-tracker-init'], self.source, self.groups))


if __name__ == '__main__':
    unittest.main()
