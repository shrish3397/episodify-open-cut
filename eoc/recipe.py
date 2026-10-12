"""Recipe management, validation, and serialization."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from eoc.models import Episode, Recipe, RecipeMeta, timestamp_to_seconds


class RecipeValidationError(Exception):
    """Raised when a recipe violates schema or narrative continuity constraints."""

    def __init__(self, message: str, errors: Optional[List[str]] = None):
        super().__init__(message)
        self.errors = errors or [message]


def validate_recipe_data(data: Dict[str, Any]) -> List[str]:
    """Validate a raw recipe dictionary against schema and continuity rules."""
    errors: List[str] = []

    # Check top-level keys
    for req_key in ["$schema", "meta", "total_episodes", "episodes"]:
        if req_key not in data:
            errors.append(f"Missing required top-level key: '{req_key}'")

    meta = data.get("meta")
    if not isinstance(meta, dict):
        errors.append("'meta' must be an object")
    else:
        for m_key in ["title", "year", "runtime_seconds"]:
            if m_key not in meta:
                errors.append(f"Missing required meta field: '{m_key}'")
        if "year" in meta and not isinstance(meta["year"], int):
            errors.append("'meta.year' must be an integer")
        if "runtime_seconds" in meta and (
            not isinstance(meta["runtime_seconds"], (int, float)) or meta["runtime_seconds"] <= 0
        ):
            errors.append("'meta.runtime_seconds' must be a positive number")

    episodes = data.get("episodes")
    if not isinstance(episodes, list):
        errors.append("'episodes' must be an array")
        return errors

    if len(episodes) < 2:
        errors.append(f"Miniseries cut requires at least 2 episodes, got {len(episodes)}")

    total_episodes = data.get("total_episodes")
    if total_episodes != len(episodes):
        errors.append(
            f"'total_episodes' ({total_episodes}) does not match episodes array length ({len(episodes)})"
        )

    # Validate individual episode fields and continuity
    prev_end_sec: Optional[float] = None
    required_ep_fields = [
        "episode_number",
        "title",
        "start_time",
        "end_time",
        "cliffhanger_rating",
        "break_rationale",
        "recap_text",
        "teaser_next",
    ]

    for idx, ep in enumerate(episodes):
        prefix = f"Episode {idx + 1}"
        if not isinstance(ep, dict):
            errors.append(f"{prefix} must be an object")
            continue

        for ef in required_ep_fields:
            if ef not in ep:
                errors.append(f"{prefix}: missing required field '{ef}'")

        try:
            start_sec = timestamp_to_seconds(ep.get("start_time", ""))
            end_sec = timestamp_to_seconds(ep.get("end_time", ""))

            if end_sec <= start_sec:
                errors.append(f"{prefix}: end_time ({ep.get('end_time')}) must be greater than start_time ({ep.get('start_time')})")

            # Continuity checks
            if idx == 0:
                if start_sec != 0.0:
                    errors.append(f"{prefix}: first episode must start at 00:00:00 (got {ep.get('start_time')})")
            else:
                if prev_end_sec is not None and abs(start_sec - prev_end_sec) > 1.0:
                    errors.append(
                        f"{prefix}: start_time ({ep.get('start_time')}) does not align with "
                        f"previous episode end_time (differs by {abs(start_sec - prev_end_sec):.1f}s)"
                    )

            prev_end_sec = end_sec
        except ValueError as e:
            errors.append(f"{prefix}: invalid timestamp format: {e}")

        # Cliffhanger rating bounds
        rating = ep.get("cliffhanger_rating")
        if rating is not None:
            if not isinstance(rating, (int, float)) or not (0.0 <= rating <= 10.0):
                errors.append(f"{prefix}: cliffhanger_rating must be between 0.0 and 10.0")

    return errors


def load_recipe(file_path: Union[str, Path]) -> Recipe:
    """Load and validate an .eoc.json recipe file."""
    path = Path(file_path)
    if not path.is_file():
        raise FileNotFoundError(f"Recipe file not found: {path}")

    content = path.read_text(encoding="utf-8")
    data = json.loads(content)

    errors = validate_recipe_data(data)
    if errors:
        raise RecipeValidationError(
            f"Recipe at '{path}' failed validation with {len(errors)} error(s)",
            errors=errors,
        )

    return Recipe.from_dict(data)


def save_recipe(recipe: Recipe, file_path: Union[str, Path]) -> Path:
    """Save recipe to an .eoc.json file after validation."""
    data = recipe.to_dict()
    errors = validate_recipe_data(data)
    if errors:
        raise RecipeValidationError(
            f"Recipe failed validation before saving with {len(errors)} error(s)",
            errors=errors,
        )

    path = Path(file_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return path
