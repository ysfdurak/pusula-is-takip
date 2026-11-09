from pathlib import Path

root = Path(__file__).resolve().parents[1]
required = [
    "README.md",
    "docs/DEMO_SENARYOLARI.md",
    "docs/MIMARI_VE_SINIRLAR.md",
    "docs/PILOT_IHTIYACLARI.md",
    "docs/img/benim-panom.png",
    "tests/e2e/smoke.mjs",
    "docs/KAYNAK_KOD_DURUMU.md",
    "src/shared/workspaceModel.js",
]
for filename in required:
    assert (root / filename).is_file(), f"Eksik: {filename}"

# README'deki yerel bağlantılar ve görseller gerçekten var mı?
import re
readme = (root / "README.md").read_text(encoding="utf-8")
for link in re.findall(r'(?:\]\(|src=")((?:docs|src|tools)/[^)"#]+)', readme):
    assert (root / link).exists(), f"README kırık bağlantı: {link}"
print("Dokumantasyon statik kontrolu gecti.")
