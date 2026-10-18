#!/usr/bin/env python3
"""Public sample archive/codec/reproducibility checks; no private source data."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import sys
import tempfile
import unittest
import zipfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("sample_recipe", ROOT / "scripts/generate-synthetic-sample.py")
recipe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recipe)
FFMPEG = os.environ.get("SPORTAGLYTICS_FFMPEG_PATH", "ffmpeg")
FFPROBE = os.environ.get("SPORTAGLYTICS_FFPROBE_PATH", "ffprobe")


class SyntheticSampleTest(unittest.TestCase):
    def test_public_archive_matches_manifest_and_portable_contract(self):
        manifest = json.loads((ROOT / "samples/synthetic-first-run.manifest.json").read_text())
        archive = ROOT / "samples" / manifest["archive"]["file"]
        self.assertEqual(hashlib.sha256(archive.read_bytes()).hexdigest(), manifest["archive"]["sha256"])
        self.assertEqual(archive.stat().st_size, manifest["archive"]["bytes"])
        with zipfile.ZipFile(archive) as bundle:
            self.assertEqual(set(bundle.namelist()), {entry["path"] for entry in manifest["files"]})
            for entry in manifest["files"]:
                parts = PurePosixPath(entry["path"]).parts
                self.assertEqual(parts[0], recipe.NAME)
                self.assertNotIn("..", parts)
                value = bundle.read(entry["path"])
                self.assertEqual(len(value), entry["bytes"])
                self.assertEqual(hashlib.sha256(value).hexdigest(), entry["sha256"])
            config = json.loads(bundle.read(f"{recipe.NAME}/.metadata/config.json"))
            timeline = json.loads(bundle.read(f"{recipe.NAME}/timeline.json"))
            self.assertEqual(config["packageFormatVersion"], 1)
            self.assertEqual(timeline["version"], 2)
            self.assertEqual(len(timeline["instances"]), 1)
            self.assertEqual(len(timeline["rows"]), 2)
            clip = config["angles"][0]["clips"][0]
            self.assertIn(f"{recipe.NAME}/{clip['relativePath']}", bundle.namelist())
            item = timeline["instances"][0]
            self.assertLess(item["startTime"], item["endTime"])
            self.assertLessEqual(item["endTime"], clip["durationSeconds"])
            self.assertIn(item["actionName"], [row["name"] for row in timeline["rows"]])
            self.assertEqual(bundle.read(f"{recipe.NAME}/LICENSE.txt"), (ROOT / "LICENSE").read_bytes())

    def test_committed_video_decodes_and_matches_config(self):
        with tempfile.TemporaryDirectory() as directory:
            video = Path(directory) / "synthetic.mp4"
            with zipfile.ZipFile(ROOT / "samples/synthetic-first-run.stpkg.zip") as bundle:
                video.write_bytes(bundle.read(f"{recipe.NAME}/videos/synthetic.mp4"))
            probe = json.loads(subprocess.check_output([
                FFPROBE, "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)
            ]))
            self.assertEqual(len(probe["streams"]), 1)
            stream = probe["streams"][0]
            self.assertEqual((stream["codec_name"], stream["width"], stream["height"]), ("h264", 640, 360))
            self.assertEqual(stream["r_frame_rate"], "24/1")
            self.assertEqual(float(probe["format"]["duration"]), 20)
            subprocess.run([FFMPEG, "-v", "error", "-xerror", "-i", str(video), "-f", "null", "-"], check=True)

    def test_repeated_recipe_is_byte_identical_with_same_encoder(self):
        with tempfile.TemporaryDirectory() as directory:
            first = recipe.build(Path(directory) / "first", FFMPEG)
            second = recipe.build(Path(directory) / "second", FFMPEG)
            self.assertEqual((first / "synthetic-first-run.stpkg.zip").read_bytes(),
                             (second / "synthetic-first-run.stpkg.zip").read_bytes())
            # The version banner is not a fingerprint of linked libx264/build options.
            # Committed bytes are checked against their manifest separately; only
            # these two invocations are guaranteed to share the same local encoder.
            with zipfile.ZipFile(first / "synthetic-first-run.stpkg.zip") as generated, \
                    zipfile.ZipFile(ROOT / "samples/synthetic-first-run.stpkg.zip") as committed:
                self.assertEqual(generated.namelist(), committed.namelist())
                for filename in generated.namelist():
                    if not filename.endswith(".mp4"):
                        self.assertEqual(generated.read(filename), committed.read(filename))

    def test_existing_output_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "existing"
            output.mkdir()
            original = output / "user-file.txt"
            original.write_text("preserve")
            with self.assertRaisesRegex(ValueError, "already exists"):
                recipe.build(output, FFMPEG)
            self.assertEqual(original.read_text(), "preserve")
            self.assertEqual(list(output.iterdir()), [original])


if __name__ == "__main__":
    unittest.main()
