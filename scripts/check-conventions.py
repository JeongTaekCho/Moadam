"""Check repository invariants that language formatters cannot enforce."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors = []

for source in (ROOT / "backend/src").rglob("*.java"):
    relative = source.relative_to(ROOT)
    match = re.search(r"^package ([\w.]+);", source.read_text(), re.MULTILINE)
    expected = ".".join(source.parts[source.parts.index("java") + 1 : -1])
    if not match or match.group(1) != expected:
        errors.append(f"{relative}: package must match directory ({expected})")

for source in [ROOT / "frontend/app/globals.css", *(ROOT / "frontend/src").rglob("*.css")]:
    if source.name == "tokens.css":
        continue
    if re.search(r"#[a-fA-F0-9]{3,8}\b|(?:rgb|hsl)a?\(", source.read_text()):
        errors.append(f"{source.relative_to(ROOT)}: define CSS colors in shared/styles/tokens.css")

required = [
    "AGENTS.md",
    "frontend/AGENTS.md",
    "backend/AGENTS.md",
    "rag/AGENTS.md",
    "supabase/AGENTS.md",
    "docs/development/conventions.md",
    "docs/development/verification.md",
    "frontend/DESIGN_SYSTEM.md",
]
for name in required:
    if not (ROOT / name).is_file():
        errors.append(f"Missing agent guide: {name}")

if errors:
    raise SystemExit("\n".join(errors))
print("Repository conventions passed: guides, Java package paths and CSS token boundaries")
