"""Keep Vercel's Python project and the Docker runtime on the same pinned versions."""

import tomllib
from pathlib import Path

rag = Path(__file__).resolve().parents[1] / "rag"
project = tomllib.loads((rag / "pyproject.toml").read_text())
locked = {
    line.strip()
    for line in (rag / "requirements.lock").read_text().splitlines()
    if line.strip() and not line.startswith("#")
}
assert project["project"]["name"] == "moadam-rag"
assert project["project"]["requires-python"] == ">=3.12,<3.13"
assert set(project["project"]["dependencies"]) == locked, (
    "RAG pyproject dependencies must match requirements.lock"
)
assert (rag / "requirements.txt").read_text().strip() == "-r requirements.lock", (
    "RAG requirements.txt must use the shared runtime lock"
)
assert project["tool"]["vercel"]["entrypoint"] == "app:app"
print("RAG Python project metadata, entrypoint and pinned dependencies match")
