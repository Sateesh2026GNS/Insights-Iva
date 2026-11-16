"""Restore largest toolkit screen versions from agent transcripts into restore_ui/."""

import json
from pathlib import Path

ROOT = Path(r"C:\Users\satee\.cursor\projects\c-Users-satee-OneDrive-Desktop-Insights-Iva\agent-transcripts")
OUT = Path(r"c:\Users\satee\OneDrive\Desktop\Insights Iva\frontend\src\pages\inventory\restore_ui")
KEEP = {
    "HamaliCost.jsx",
    "UnitConverter.jsx",
    "TruckLoadPlanner.jsx",
    "DamageLoss.jsx",
    "StorageQuotation.jsx",
    "GatePass.jsx",
    "StockValuation.jsx",
    "EoqHelper.jsx",
    "GodownDashboard.jsx",
    "GodownCapacityPlanner.jsx",
}

SOURCES = [
    ROOT / "a99837f1-a134-4adf-a62c-87678c658e04" / "a99837f1-a134-4adf-a62c-87678c658e04.jsonl",
    ROOT / "bbe3e6b1-5e7b-46f4-8fc0-30342324ba0e" / "bbe3e6b1-5e7b-46f4-8fc0-30342324ba0e.jsonl",
    ROOT / "421f62be-96c9-40ca-8d8f-da530b8f4c58" / "421f62be-96c9-40ca-8d8f-da530b8f4c58.jsonl",
    ROOT / "e7cc3092-500d-401e-bbe7-1c7a39f7a3cf" / "e7cc3092-500d-401e-bbe7-1c7a39f7a3cf.jsonl",
]


def collect() -> dict:
    best = {}
    for path in SOURCES:
        if not path.exists():
            continue
        for line in path.open(encoding="utf-8"):
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            content = (obj.get("message") or {}).get("content")
            if not isinstance(content, list):
                continue
            for part in content:
                if not isinstance(part, dict) or part.get("name") != "Write":
                    continue
                inp = part.get("input") or {}
                name = str(inp.get("path") or "").replace("\\", "/").split("/")[-1]
                contents = inp.get("contents")
                if name not in KEEP or not isinstance(contents, str):
                    continue
                current = best.get(name)
                if current is None or len(contents) > len(current):
                    best[name] = contents
    return best


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    best = collect()
    for name, contents in sorted(best.items()):
        (OUT / name).write_text(contents, encoding="utf-8", newline="\n")
        print(f"{name}: {len(contents)}")
    print("missing", sorted(KEEP - set(best)))


if __name__ == "__main__":
    main()
