"""Command-line interface for Episodify Open Cut (eoc)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import List, Optional

from eoc import __version__
from eoc.analyzer import build_episodic_recipe
from eoc.exporters import export_chapter_srt, export_ffmpeg_metadata, export_mkv_xml
from eoc.models import timestamp_to_seconds
from eoc.parser import parse_subtitles
from eoc.recipe import RecipeValidationError, load_recipe, save_recipe, validate_recipe_data
from eoc.snapper import snap_to_micro_break

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


def print_banner() -> None:
    banner = rf"""
  _____       _                _ _  __       
 | ____|_ __ (_)___  ___   __| (_)/ _|_   _  
 |  _| | '_ \| / __|/ _ \ / _` | | |_| | | | 
 | |___| |_) | \__ \ (_) | (_| | |  _| |_| | 
 |_____| .__/|_|___/\___/ \__,_|_|_|  \__, | 
       |_|     O P E N   C U T         |___/  v{__version__}
    """
    print(banner)


def handle_cut(args: argparse.Namespace) -> int:
    """Handle 'cut' subcommand."""
    print(f"🎬 Processing: {args.title} ({args.year})")
    print(f"📄 Subtitles: {args.subtitles}")

    try:
        cues = parse_subtitles(args.subtitles)
        print(f"   Parsed {len(cues)} dialogue cues.")
    except Exception as e:
        print(f"❌ Error reading subtitles: {e}", file=sys.stderr)
        return 1

    runtime = args.runtime
    if runtime is not None:
        if isinstance(runtime, str) and ":" in runtime:
            runtime = int(timestamp_to_seconds(runtime))
        else:
            runtime = int(runtime)

    print(f"🧠 Analyzing narrative structure (Provider: {args.provider})...")

    try:
        recipe = build_episodic_recipe(
            cues=cues,
            title=args.title,
            year=args.year,
            runtime_seconds=runtime,
            imdb_id=args.imdb,
            episodes_count=args.episodes,
            pacing=args.pacing,
            provider=args.provider,
            gemini_api_key=args.gemini_key,
        )
    except Exception as e:
        print(f"❌ Analysis failed: {e}", file=sys.stderr)
        return 1

    out_path = args.output
    if not out_path:
        slug = args.title.lower().replace(" ", "-").replace(":", "")
        filename = f"{slug}-{args.year}.eoc.json"
        out_dir = Path("output")
        out_path = str(out_dir / filename) if out_dir.is_dir() else filename

    saved = save_recipe(recipe, out_path)
    print(f"\n✨ Successfully generated {recipe.total_episodes}-episode miniseries cut!")
    print(f"💾 Recipe saved to: {saved}\n")

    display_recipe_info(recipe)
    return 0


def handle_validate(args: argparse.Namespace) -> int:
    """Handle 'validate' subcommand."""
    recipe_path = Path(args.recipe)
    if not recipe_path.exists():
        print(f"❌ Recipe file not found: {recipe_path}", file=sys.stderr)
        return 1

    try:
        data = json.loads(recipe_path.read_text(encoding="utf-8"))
        errors = validate_recipe_data(data)
        if errors:
            print(f"❌ Validation failed for {recipe_path.name} ({len(errors)} errors):")
            for err in errors:
                print(f"   - {err}")
            return 1

        recipe = load_recipe(recipe_path)
        print(f"✅ Recipe '{recipe_path.name}' is fully valid!")
        print(f"   Film: {recipe.meta.title} ({recipe.meta.year})")
        print(f"   Episodes: {recipe.total_episodes}")
        return 0
    except Exception as e:
        print(f"❌ Validation error: {e}", file=sys.stderr)
        return 1


def display_recipe_info(recipe) -> None:
    """Pretty-print recipe summary to terminal."""
    meta = recipe.meta
    print("=" * 70)
    print(f"📽️  {meta.title.upper()} ({meta.year})")
    print(f"⏱️  Runtime: {meta.runtime_seconds // 60} mins ({meta.runtime_seconds}s) | Pacing: {meta.pacing}")
    if meta.imdb_id:
        print(f"🍿 IMDb: {meta.imdb_id} | Generator: {meta.generator}")
    print("=" * 70)

    for ep in recipe.episodes:
        stars = "★" * int(round(ep.cliffhanger_rating / 2.0))
        print(
            f"\nEpisode {ep.episode_number}: {ep.title}\n"
            f"  Time: {ep.start_time} ➔ {ep.end_time} ({ep.formatted_duration})\n"
            f"  Cliffhanger Rating: {ep.cliffhanger_rating}/10 {stars}\n"
            f"  Break Rationale: {ep.break_rationale}\n"
            f"  Recap: {ep.recap_text}\n"
            f"  Teaser: {ep.teaser_next}"
        )
    print("=" * 70)


def handle_info(args: argparse.Namespace) -> int:
    """Handle 'info' subcommand."""
    try:
        recipe = load_recipe(args.recipe)
        display_recipe_info(recipe)
        return 0
    except Exception as e:
        print(f"❌ Error reading recipe: {e}", file=sys.stderr)
        return 1


def handle_snap(args: argparse.Namespace) -> int:
    """Handle 'snap' subcommand to test dialogue lull detection."""
    try:
        cues = parse_subtitles(args.subtitles)
        target_sec = timestamp_to_seconds(args.time)
        res = snap_to_micro_break(
            cues,
            target_sec,
            window_seconds=args.window,
            min_gap_seconds=args.min_gap,
        )

        print(f"🎯 Target Time: {args.time} ({target_sec:.1f}s)")
        print(f"📍 Snapped Time: {res.snapped_timestamp} ({res.snapped_seconds:.1f}s)")
        print(f"⏱️  Adjustment: {res.adjustment_seconds:+.2f}s")
        print(f"🔇 Silence Gap: {res.gap_duration:.2f}s")
        if res.preceding_cue:
            print(f'   Preceding dialogue: "{res.preceding_cue.text}" [{res.preceding_cue.formatted_start()} -> {res.preceding_cue.formatted_end()}]')
        if res.succeeding_cue:
            print(f'   Succeeding dialogue: "{res.succeeding_cue.text}" [{res.succeeding_cue.formatted_start()} -> {res.succeeding_cue.formatted_end()}]')
        return 0
    except Exception as e:
        print(f"❌ Snap failed: {e}", file=sys.stderr)
        return 1


def handle_export(args: argparse.Namespace) -> int:
    """Handle 'export' subcommand."""
    try:
        recipe = load_recipe(args.recipe)
        fmt = args.format.lower()
        if fmt == "ffmpeg":
            content = export_ffmpeg_metadata(recipe)
            ext = ".txt"
        elif fmt == "mkv":
            content = export_mkv_xml(recipe)
            ext = ".xml"
        elif fmt == "srt":
            content = export_chapter_srt(recipe)
            ext = ".srt"
        else:
            print(f"❌ Unsupported format: {fmt}", file=sys.stderr)
            return 1

        if args.output:
            out_path = args.output
        else:
            filename = f"{Path(args.recipe).stem}_chapters{ext}"
            out_dir = Path("output")
            out_path = str(out_dir / filename) if out_dir.is_dir() else filename

        Path(out_path).write_text(content, encoding="utf-8")
        print(f"✅ Exported {fmt.upper()} chapters to: {out_path}")
        return 0
    except Exception as e:
        print(f"❌ Export failed: {e}", file=sys.stderr)
        return 1


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        prog="eoc",
        description="Episodify Open Cut: Transform 3-hour movies into bingeable miniseries.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")

    subparsers = parser.add_subparsers(dest="command", required=True)

    # Subcommand: cut
    cut_parser = subparsers.add_parser("cut", help="Slice movie subtitles into an episodic .eoc.json recipe")
    cut_parser.add_argument("subtitles", help="Path to .srt or .vtt subtitle file")
    cut_parser.add_argument("--title", "-t", required=True, help="Movie title")
    cut_parser.add_argument("--year", "-y", type=int, default=2024, help="Release year (default: 2024)")
    cut_parser.add_argument("--runtime", "-r", help="Total movie runtime (seconds or HH:MM:SS)")
    cut_parser.add_argument("--imdb", help="IMDb ID (e.g. tt15398776)")
    cut_parser.add_argument("--episodes", "-e", type=int, help="Target episode count (default: auto)")
    cut_parser.add_argument(
        "--pacing",
        default="prestige_drama",
        choices=["prestige_drama", "action_thriller", "fast_pace", "slow_cinema", "comedy", "epic"],
        help="Pacing profile (default: prestige_drama)",
    )
    cut_parser.add_argument(
        "--provider",
        default="auto",
        choices=["auto", "gemini", "ollama", "heuristic"],
        help="AI / narrative engine provider (default: auto)",
    )
    cut_parser.add_argument("--gemini-key", help="Google Gemini API key (or set GEMINI_API_KEY env var)")
    cut_parser.add_argument("--output", "-o", help="Output .eoc.json file path")

    # Subcommand: validate
    val_parser = subparsers.add_parser("validate", help="Validate an .eoc.json recipe")
    val_parser.add_argument("recipe", help="Path to .eoc.json file")

    # Subcommand: info
    info_parser = subparsers.add_parser("info", help="Display details of an .eoc.json recipe")
    info_parser.add_argument("recipe", help="Path to .eoc.json file")

    # Subcommand: snap
    snap_parser = subparsers.add_parser("snap", help="Test micro-cut snapping against dialogue lulls")
    snap_parser.add_argument("subtitles", help="Path to .srt or .vtt subtitle file")
    snap_parser.add_argument("--time", required=True, help="Target timestamp (HH:MM:SS or seconds)")
    snap_parser.add_argument("--window", type=float, default=30.0, help="Search window in seconds (default: 30)")
    snap_parser.add_argument("--min-gap", type=float, default=1.5, help="Minimum silence lull in seconds (default: 1.5)")

    # Subcommand: export
    exp_parser = subparsers.add_parser("export", help="Export recipe to video chapter format (FFmpeg/MKV/SRT)")
    exp_parser.add_argument("recipe", help="Path to .eoc.json file")
    exp_parser.add_argument("--format", "-f", default="ffmpeg", choices=["ffmpeg", "mkv", "srt"])
    exp_parser.add_argument("--output", "-o", help="Output file path")

    args = parser.parse_args(argv)

    if args.command == "cut":
        return handle_cut(args)
    elif args.command == "validate":
        return handle_validate(args)
    elif args.command == "info":
        return handle_info(args)
    elif args.command == "snap":
        return handle_snap(args)
    elif args.command == "export":
        return handle_export(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
