"""Unit tests for subtitle parsing."""

import unittest
from pathlib import Path

from eoc.models import timestamp_to_seconds, seconds_to_timestamp
from eoc.parser import parse_subtitles, parse_subtitles_from_content, clean_subtitle_text

FIXTURES_DIR = Path(__file__).parent / "fixtures"


class TestParser(unittest.TestCase):
    def test_time_conversions(self):
        self.assertEqual(timestamp_to_seconds("00:00:00"), 0.0)
        self.assertEqual(timestamp_to_seconds("01:00:00"), 3600.0)
        self.assertEqual(timestamp_to_seconds("00:46:18"), 2778.0)
        self.assertEqual(timestamp_to_seconds("01:34:05.500"), 5645.5)
        self.assertEqual(timestamp_to_seconds("01:34:05,500"), 5645.5)

        self.assertEqual(seconds_to_timestamp(0.0), "00:00:00")
        self.assertEqual(seconds_to_timestamp(3665.0), "01:01:05")
        self.assertEqual(seconds_to_timestamp(2778.0), "00:46:18")
        self.assertEqual(seconds_to_timestamp(3665.250, include_millis=True), "01:01:05.250")

    def test_clean_subtitle_text(self):
        raw = "<i>Hello</i> <b>world</b> <font color='red'>test</font> {\\an8}done!"
        self.assertEqual(clean_subtitle_text(raw), "Hello world test done!")

    def test_parse_srt_file(self):
        srt_path = FIXTURES_DIR / "sample.srt"
        cues = parse_subtitles(srt_path)
        self.assertEqual(len(cues), 9)
        self.assertEqual(cues[0].text, "We knew the world would not be the same.")
        self.assertEqual(cues[0].start_time, 10.5)
        self.assertEqual(cues[0].end_time, 14.2)
        self.assertEqual(cues[3].text, "Now I am become Death, the destroyer of worlds.")

    def test_parse_vtt_file(self):
        vtt_path = FIXTURES_DIR / "sample.vtt"
        cues = parse_subtitles(vtt_path)
        self.assertEqual(len(cues), 3)
        self.assertEqual(cues[0].text, "We knew the world would not be the same.")
        self.assertEqual(cues[1].text, "A few people laughed, a few people cried.")

    def test_parse_invalid_file(self):
        with self.assertRaises(FileNotFoundError):
            parse_subtitles("non_existent_file.srt")


if __name__ == "__main__":
    unittest.main()
