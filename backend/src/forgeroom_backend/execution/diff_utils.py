from __future__ import annotations

import re
from pathlib import Path


class DiffValidationError(ValueError):
    pass


def extract_paths(diff_text: str) -> list[str]:
    paths = []
    for line in diff_text.splitlines():
        if line.startswith("+++ "):
            path = line[4:].strip()
            if path.startswith("b/"):
                path = path[2:]
            if path != "/dev/null":
                paths.append(path)
    return paths


def validate_diff(diff_text: str, repo_root: Path) -> None:
    if not diff_text.strip():
        raise DiffValidationError("Diff is empty.")
    if not diff_text.lstrip().startswith("--- "):
        raise DiffValidationError("Diff must start with a unified diff header.")

    for path in extract_paths(diff_text):
        resolved = (repo_root / path).resolve()
        if repo_root.resolve() not in resolved.parents and resolved != repo_root.resolve():
            raise DiffValidationError(f"Diff references path outside repo: {path}")
        if any(part in {".git", ".."} for part in Path(path).parts):
            raise DiffValidationError(f"Diff references unsafe path: {path}")

    if not re.search(r"^@@ ", diff_text, flags=re.MULTILINE):
        raise DiffValidationError("Diff does not contain any hunks.")
