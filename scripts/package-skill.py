"""Build and verify the standalone, reproducible system-flow skill archive.

Run after ``npm run build`` so the bundled browser and CLI assets are current.
Only the contents of ``system-flow/`` are distributed; repository source,
examples, local dependencies, and temporary caches are not included.
"""

from __future__ import annotations

import argparse
from hashlib import sha256
from io import BytesIO
import json
import os
from pathlib import Path
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parent.parent
SKILL = ROOT / "system-flow"
ARCHIVE = ROOT / "artifacts" / "system-flow-v2.zip"
REPORT = ROOT / "artifacts" / "package" / "archive.json"
SKIP_DIRS = frozenset({"node_modules", "__pycache__", ".cache", ".pytest_cache", ".mypy_cache", ".ruff_cache"})
SKIP_FILES = frozenset({".DS_Store", "Thumbs.db"})
SKIP_SUFFIXES = (".pyc", ".pyo", ".pyd", ".tmp", ".swp", ".swo", "~")
ZIP_TIME = (1980, 1, 1, 0, 0, 0)


def collect_files(source: Path) -> list[tuple[str, bytes]]:
    if not source.is_dir() or source.is_symlink():
        raise ValueError(f"Skill directory is missing or is a symlink: {source}")
    files: list[tuple[str, bytes]] = []
    for directory, names, filenames in os.walk(source, followlinks=False):
        names[:] = sorted(name for name in names if name not in SKIP_DIRS)
        for name in names:
            if (Path(directory) / name).is_symlink():
                raise ValueError(f"Refusing symlinked directory: {Path(directory) / name}")
        for name in sorted(filenames):
            if name in SKIP_FILES or name.endswith(SKIP_SUFFIXES):
                continue
            path = Path(directory) / name
            if path.is_symlink() or not path.is_file():
                raise ValueError(f"Refusing non-regular file: {path}")
            relative = path.relative_to(source).as_posix()
            files.append((f"system-flow/{relative}", path.read_bytes()))
    files.sort(key=lambda item: item[0])
    required = {"system-flow/SKILL.md", "system-flow/package.json", "system-flow/assets/viewer.js", "system-flow/scripts/generate.mjs"}
    missing = required.difference(name for name, _ in files)
    if missing:
        raise ValueError(f"Incomplete skill directory; missing: {', '.join(sorted(missing))}")
    return files


def make_archive(files: list[tuple[str, bytes]]) -> bytes:
    output = BytesIO()
    with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for name, content in files:
            entry = ZipInfo(name, date_time=ZIP_TIME)
            entry.compress_type = ZIP_DEFLATED
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, content, compress_type=ZIP_DEFLATED, compresslevel=9)
    return output.getvalue()


def verify_archive(archive_bytes: bytes, files: list[tuple[str, bytes]]) -> list[dict[str, object]]:
    expected = dict(files)
    with ZipFile(BytesIO(archive_bytes)) as archive:
        entries = archive.infolist()
        names = [entry.filename for entry in entries]
        if names != list(expected):
            raise ValueError("Archive entry order or file list differs from the skill directory")
        if archive.testzip() is not None:
            raise ValueError("Archive CRC verification failed")
        manifest = []
        for entry in entries:
            original = expected[entry.filename]
            zipped = archive.read(entry)
            if zipped != original:
                raise ValueError(f"Archive content differs: {entry.filename}")
            if entry.date_time != ZIP_TIME:
                raise ValueError(f"Archive timestamp is not reproducible: {entry.filename}")
            manifest.append({"path": entry.filename, "bytes": len(zipped), "sha256": sha256(zipped).hexdigest()})
    return manifest


def write_atomic(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent, delete=False) as output:
            temporary = Path(output.name)
            output.write(content)
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SKILL, help="Skill directory to package")
    parser.add_argument("--output", type=Path, default=ARCHIVE, help="ZIP output path")
    parser.add_argument("--report", type=Path, default=REPORT, help="Per-file verification report path")
    parser.add_argument("--check", action="store_true", help="Verify existing ZIP and report without writing")
    args = parser.parse_args()

    source_path = args.source.resolve()
    archive_path = args.output.resolve()
    report_path = args.report.resolve()
    if archive_path == report_path or archive_path.is_relative_to(source_path) or report_path.is_relative_to(source_path):
        parser.error("ZIP and report must be separate files outside the skill directory")
    files = collect_files(args.source)
    archive_bytes = archive_path.read_bytes() if args.check else make_archive(files)
    manifest = verify_archive(archive_bytes, files)
    report = {
        "path": archive_path.relative_to(ROOT).as_posix() if archive_path.is_relative_to(ROOT) else str(archive_path),
        "files": len(files),
        "bytes": len(archive_bytes),
        "sha256": sha256(archive_bytes).hexdigest(),
        "status": "passed",
        "excludes": sorted(SKIP_DIRS),
        "entries": manifest,
    }
    report_bytes = (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    if args.check:
        if report_path.read_bytes() != report_bytes:
            raise ValueError("Archive report differs from verified ZIP; rerun package:skill")
    else:
        write_atomic(archive_path, archive_bytes)
        write_atomic(report_path, report_bytes)
        if archive_path.read_bytes() != archive_bytes or report_path.read_bytes() != report_bytes:
            raise ValueError("Written ZIP or report differs from verified bytes")
    print(json.dumps({"status": "passed", "mode": "check" if args.check else "package", "path": report["path"], "files": report["files"], "bytes": report["bytes"], "sha256": report["sha256"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
