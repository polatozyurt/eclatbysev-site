#!/bin/bash
# Double-click to open the Éclat By Sev admin panel (macOS).
cd "$(dirname "$0")/.." || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 bulunamadı. Terminalde 'xcode-select --install' çalıştırın ve tekrar deneyin."
  read -r -p "Kapatmak için Enter'a basın…"
  exit 1
fi
python3 admin/server.py
