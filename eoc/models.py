"""Data models and time conversions for Episodify Open Cut."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional


def timestamp_to_seconds(ts: str) -> float:
    """Convert an HH:MM:SS or HH:MM:SS.mmm / HH:MM:SS,mmm string to float seconds."""
    ts = ts.strip().replace(",", ".")
    parts = ts.split(":")
    if len(parts) == 3:
        hours = float(parts[0])
        minutes = float(parts[1])
        seconds = float(parts[2])
        return hours * 3600.0 + minutes * 60.0 + seconds
    elif len(parts) == 2:
        minutes = float(parts[0])
        seconds = float(parts[1])
        return minutes * 60.0 + seconds
    else:
        try:
            return float(ts)
        except ValueError as err:
            raise ValueError(f"Invalid timestamp format: {ts}") from err


def seconds_to_timestamp(seconds: float, include_millis: bool = False) -> str:
    """Convert float seconds to HH:MM:SS or HH:MM:SS.mmm formatted string."""
    if seconds < 0:
        seconds = 0.0

    total_secs = int(seconds)
    hours = total_secs // 3600
    minutes = (total_secs % 3600) // 60
    secs = total_secs % 60

    if include_millis:
        millis = int(round((seconds - total_secs) * 1000))
        if millis >= 1000:
            millis = 999
        return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


@dataclass
class SubtitleCue:
    """A single subtitle line/cue with timing in seconds."""

    index: int
    start_time: float
    end_time: float
    text: str

    @property
    def duration(self) -> float:
        return max(0.0, self.end_time - self.start_time)

    def formatted_start(self, include_millis: bool = True) -> str:
        return seconds_to_timestamp(self.start_time, include_millis)

    def formatted_end(self, include_millis: bool = True) -> str:
        return seconds_to_timestamp(self.end_time, include_millis)


@dataclass
class Episode:
    """An episodic segment definition within a movie recipe."""

    episode_number: int
    title: str
    start_time: str
    end_time: str
    cliffhanger_rating: float
    break_rationale: str
    recap_text: str
    teaser_next: str

    @property
    def start_seconds(self) -> float:
        return timestamp_to_seconds(self.start_time)

    @property
    def end_seconds(self) -> float:
        return timestamp_to_seconds(self.end_time)

    @property
    def duration_seconds(self) -> float:
        return max(0.0, self.end_seconds - self.start_seconds)

    @property
    def formatted_duration(self) -> str:
        mins = int(self.duration_seconds // 60)
        secs = int(self.duration_seconds % 60)
        return f"{mins}m {secs:02d}s"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Episode:
        return cls(
            episode_number=int(data["episode_number"]),
            title=str(data["title"]),
            start_time=str(data["start_time"]),
            end_time=str(data["end_time"]),
            cliffhanger_rating=float(data["cliffhanger_rating"]),
            break_rationale=str(data["break_rationale"]),
            recap_text=str(data["recap_text"]),
            teaser_next=str(data["teaser_next"]),
        )


@dataclass
class RecipeMeta:
    """Metadata describing the feature film."""

    title: str
    year: int
    runtime_seconds: int
    imdb_id: Optional[str] = None
    tmdb_id: Optional[int] = None
    pacing: str = "prestige_drama"
    generator: str = "eoc-core"

    def to_dict(self) -> Dict[str, Any]:
        data = {
            "title": self.title,
            "year": self.year,
            "runtime_seconds": self.runtime_seconds,
            "pacing": self.pacing,
            "generator": self.generator,
        }
        if self.imdb_id:
            data["imdb_id"] = self.imdb_id
        if self.tmdb_id:
            data["tmdb_id"] = self.tmdb_id
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> RecipeMeta:
        return cls(
            title=str(data["title"]),
            year=int(data["year"]),
            runtime_seconds=int(data["runtime_seconds"]),
            imdb_id=data.get("imdb_id"),
            tmdb_id=data.get("tmdb_id"),
            pacing=data.get("pacing", "prestige_drama"),
            generator=data.get("generator", "eoc-core"),
        )


@dataclass
class Recipe:
    """Complete episodic cut recipe (.eoc.json)."""

    meta: RecipeMeta
    total_episodes: int
    episodes: List[Episode]
    schema: str = "https://episodify.org/schema/v1.json"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "$schema": self.schema,
            "meta": self.meta.to_dict(),
            "total_episodes": self.total_episodes,
            "episodes": [ep.to_dict() for ep in self.episodes],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Recipe:
        meta = RecipeMeta.from_dict(data["meta"])
        episodes = [Episode.from_dict(ep) for ep in data.get("episodes", [])]
        schema = data.get("$schema", "https://episodify.org/schema/v1.json")
        total_episodes = int(data.get("total_episodes", len(episodes)))
        return cls(
            meta=meta,
            total_episodes=total_episodes,
            episodes=episodes,
            schema=schema,
        )
