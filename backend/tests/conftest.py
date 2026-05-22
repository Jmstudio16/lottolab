"""
Pytest conftest for backend test suites.
Auto-loads `.env.test` so that test files can reference credentials via
`os.environ.get(...)` without committing literal secrets.
"""
import os
from pathlib import Path


def _load_env_test() -> None:
    env_path = Path(__file__).parent / ".env.test"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        # Do not override values already set in the actual environment.
        os.environ.setdefault(key, value)


_load_env_test()
