"""Write only the enumerated staging tree, with portable, repeatable metadata."""
import gzip
import os
import pathlib
import sys
import tarfile
import tempfile

root = pathlib.Path(sys.argv[1])
output = pathlib.Path(sys.argv[2])
temporary = tempfile.NamedTemporaryFile(dir=output.parent, delete=False)
try:
    with temporary as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", filename="", mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode="w", format=tarfile.USTAR_FORMAT) as archive:
                for path in [root] + sorted(root.rglob("*")):
                    if path.is_symlink() or not (path.is_file() or path.is_dir()):
                        raise ValueError("Source bundle accepts regular files/directories only")
                    if path.name == ".DS_Store" or path.name.startswith("._"):
                        raise ValueError("Unexpected filesystem metadata in source staging")
                    name = "media-tools-sources"
                    if path != root:
                        name += "/" + path.relative_to(root).as_posix()
                    info = tarfile.TarInfo(name)
                    info.uid = info.gid = info.mtime = 0
                    info.uname = info.gname = ""
                    info.mode = 0o755 if path.is_dir() else 0o644
                    if path.is_dir():
                        info.type = tarfile.DIRTYPE
                        archive.addfile(info)
                    else:
                        info.size = path.stat().st_size
                        with path.open("rb") as payload:
                            archive.addfile(info, payload)
    # Hard-link publication is atomic and refuses an existing destination.
    os.link(temporary.name, output)
finally:
    pathlib.Path(temporary.name).unlink()
