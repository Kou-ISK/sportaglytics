#!/usr/bin/env python3
"""Build the public first-run sample from geometric FFmpeg sources only (MIT)."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
NAME = "Synthetic-first-run.stpkg"
FILTER = (
    "color=c=0x134e4a:s=640x360:r=24:d=20,"
    "drawgrid=w=80:h=90:t=1:c=white@0.25,"
    "drawbox=x=319:y=0:w=2:h=360:c=white:t=fill,"
    "drawbox=x=20:y=120:w=60:h=120:c=0x4ba3ff:t=fill,"
    "drawbox=x=560:y=120:w=60:h=120:c=0xff9950:t=fill[field];"
    "color=c=white:s=16x16:r=24:d=20[marker];"
    "[field][marker]overlay=x='20+mod(t*28,580)':y='172+80*sin(t)':shortest=1"
)


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build(output, ffmpeg):
    output = output.resolve()
    if output.exists():
        raise ValueError("Output already exists; choose a new directory (nothing was overwritten).")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="synthetic-sample-", dir=output.parent) as temporary:
        staging = Path(temporary)
        package = staging / NAME
        (package / ".metadata").mkdir(parents=True)
        (package / "videos").mkdir()
        command = [
            ffmpeg, "-hide_banner", "-loglevel", "error", "-filter_complex_threads", "1",
            "-f", "lavfi", "-i", FILTER, "-map_metadata", "-1", "-an", "-c:v", "libx264",
            "-threads", "1", "-preset", "medium", "-crf", "28", "-pix_fmt", "yuv420p",
            "-fflags", "+bitexact", "-flags:v", "+bitexact", "-movflags", "+faststart",
            str(package / "videos" / "synthetic.mp4"),
        ]
        subprocess.run(command, check=True)
        write_json(package / ".metadata" / "config.json", {
            "packageFormatVersion": 1, "team1Name": "Blue", "team2Name": "Orange",
            "primaryAngleId": "angle-1", "angles": [{
                "id": "angle-1", "name": "Synthetic shapes", "sourceKind": "local",
                "relativePath": "videos/synthetic.mp4", "clips": [{
                    "id": "clip-1", "sourceKind": "local", "relativePath": "videos/synthetic.mp4",
                    "gapBeforeSeconds": 0, "timelineStartSeconds": 0, "durationSeconds": 20,
                }],
            }],
        })
        write_json(package / "timeline.json", {
            "version": 2,
            "rows": [
                {"id": "practice-pass", "name": "練習 / パス", "color": "#2277aa"},
                {"id": "practice-note", "name": "練習 / メモ", "color": "#bb5533"},
            ],
            "instances": [{
                "id": "synthetic-first-tag", "actionName": "練習 / パス", "startTime": 2,
                "endTime": 5, "memo": "合成映像の練習用タグ", "labels": [], "color": "#2277aa",
            }],
        })
        shutil.copyfile(ROOT / "LICENSE", package / "LICENSE.txt")
        (package / "SAMPLE.txt").write_text(
            "SporTagLytics synthetic first-run sample\n"
            "20 seconds, 640 x 360, 24 fps, silent H.264. Geometric shapes only.\n"
            "No people, match recording, external images, fonts, models or generated-AI assets.\n"
            "Recipe: scripts/generate-synthetic-sample.py in the SporTagLytics repository.\n"
            "The recipe and sample are distributed under the repository MIT license (LICENSE.txt).\n"
            "This is a manual tagging/export exercise, not model accuracy ground truth.\n"
            "Extract the ZIP, then open the .stpkg folder (not the ZIP) in SporTagLytics.\n"
            "Walkthrough: https://github.com/Kou-ISK/sportaglytics/blob/develop/docs/quickstart.md\n",
            encoding="utf-8",
        )
        archive = staging / "synthetic-first-run.stpkg.zip"
        files = sorted(path for path in package.rglob("*") if path.is_file())
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_STORED) as bundle:
            for path in files:
                info = zipfile.ZipInfo(path.relative_to(staging).as_posix(), (2026, 1, 1, 0, 0, 0))
                info.create_system = 3
                info.external_attr = 0o100644 << 16
                bundle.writestr(info, path.read_bytes())
        artifacts = staging / "artifacts"
        artifacts.mkdir()
        archive.rename(artifacts / archive.name)
        archive = artifacts / archive.name
        version = subprocess.check_output([ffmpeg, "-version"], text=True).splitlines()[0]
        write_json(artifacts / "synthetic-first-run.manifest.json", {
            "recipe": "scripts/generate-synthetic-sample.py", "license": "MIT",
            "source": "Repository-authored geometric color/grid/overlay expressions; no external source media",
            "ffmpegVersion": version, "videoEncoder": "libx264", "zipCompression": "stored",
            "archive": {"file": archive.name, "bytes": archive.stat().st_size,
                        "sha256": hashlib.sha256(archive.read_bytes()).hexdigest()},
            "files": [{"path": path.relative_to(staging).as_posix(), "bytes": path.stat().st_size,
                       "sha256": hashlib.sha256(path.read_bytes()).hexdigest()} for path in files],
        })
        artifacts.rename(output)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "output" / "synthetic-sample")
    parser.add_argument("--ffmpeg", default=os.environ.get("SPORTAGLYTICS_FFMPEG_PATH", "ffmpeg"))
    args = parser.parse_args()
    try:
        result = build(args.output, args.ffmpeg)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"Sample generation failed: {error}\n")
    print(f"Created {result / 'synthetic-first-run.stpkg.zip'}")


if __name__ == "__main__":
    main()
