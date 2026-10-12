"""Subtitle parsing engine for SRT and WebVTT formats."""

from __future__ import annotations

import re
from pathlib import Path
from typing import List, Union

from eoc.models import SubtitleCue, timestamp_to_seconds

HTML_TAG_REGEX = re.compile(r"<[^>]+>")
STYLE_TAG_REGEX = re.compile(r"\{[^}]+\}")
TIMECODE_REGEX = re.compile(
    r"(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3})"
)


def clean_subtitle_text(text: str) -> str:
    """Remove HTML formatting and styling tags from subtitle text."""
    clean = HTML_TAG_REGEX.sub("", text)
    clean = STYLE_TAG_REGEX.sub("", clean)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean


def parse_subtitles_from_content(content: str) -> List[SubtitleCue]:
    """Parse subtitle text content (SRT or WebVTT) into SubtitleCue objects."""
    # Normalize line endings
    content = content.replace("\r\n", "\n").replace("\r", "\n")

    # If WebVTT header present, strip preamble
    if content.startswith("WEBVTT"):
        parts = content.split("\n\n", 1)
        if len(parts) > 1:
            content = parts[1]

    # Split into blocks by double newlines
    blocks = re.split(r"\n\s*\n", content.strip())
    cues: List[SubtitleCue] = []
    idx = 1

    for block in blocks:
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        if not lines:
            continue

        match = None
        match_line_idx = -1

        for i, line in enumerate(lines):
            match = TIMECODE_REGEX.search(line)
            if match:
                match_line_idx = i
                break

        if not match:
            continue

        start_str, end_str = match.groups()
        try:
            start_sec = timestamp_to_seconds(start_str)
            end_sec = timestamp_to_seconds(end_str)
        except ValueError:
            continue

        # Remaining lines after timecode form the dialogue
        dialogue_lines = lines[match_line_idx + 1 :]
        text = clean_subtitle_text(" ".join(dialogue_lines))

        # Only add cues that have valid timings and duration
        if end_sec >= start_sec:
            cues.append(
                SubtitleCue(
                    index=idx,
                    start_time=start_sec,
                    end_time=end_sec,
                    text=text,
                )
            )
            idx += 1

    # Sort cues by start time
    cues.sort(key=lambda c: c.start_time)
    return cues


def parse_subtitles(file_path: Union[str, Path]) -> List[SubtitleCue]:
    """Read and parse an .srt or .vtt file with automatic encoding fallback."""
    path = Path(file_path)
    if not path.is_file():
        raise FileNotFoundError(f"Subtitle file not found: {path}")

    encodings = ["utf-8-sig", "utf-8", "cp1252", "latin-1"]
    content: str | None = None

    for enc in encodings:
        try:
            content = path.read_text(encoding=enc)
            break
        except UnicodeDecodeError:
            continue

    if content is None:
        raise ValueError(f"Unable to decode subtitle file {path} using supported encodings.")

    cues = parse_subtitles_from_content(content)
    if not cues:
        raise ValueError(f"No valid subtitle cues parsed from {path}")
    return cues
