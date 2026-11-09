from pathlib import Path

root = Path(__file__).resolve().parents[1]
required = ["README.md", "docs/URUN_TANITIMI.md", "docs/DEMO_SENARYOLARI.md"]
for filename in required:
    assert (root / filename).is_file(), f"Eksik: {filename}"
print("Dokumantasyon statik kontrolu gecti.")
