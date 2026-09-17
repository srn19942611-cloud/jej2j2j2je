#!/bin/sh
# Henter DWG- og PDF-motoren ned i mappen vendor/, så Lysplan også
# virker uden internet. Kør én gang med netforbindelse.
# Kræver Node (npm). LibreDWG er GPL-3 - filerne bliver liggende lokalt
# hos dig og skal ikke lægges i et delt repository.
cd "$(dirname "$0")" || exit 1
mkdir -p vendor && cd vendor || exit 1

hent() {
  navn=$1; version=$2; mappe=$3
  echo "Henter $navn@$version ..."
  npm pack "$navn@$version" --silent >/dev/null || { echo "  kunne ikke hentes"; return 1; }
  fil=$(ls -t *.tgz | head -1)
  rm -rf "$mappe" && mkdir -p "$mappe"
  tar xzf "$fil" -C "$mappe" --strip-components=1
  rm -f "$fil"
  echo "  lagt i vendor/$mappe"
}

hent "@mlightcad/libredwg-web" "0.7.10" "libredwg-web"
hent "pdfjs-dist" "3.11.174" "pdfjs-dist"

echo
echo "Færdig. Skriv stien vendor/libredwg-web/ i Lysplan under Tegninger -> Avanceret,"
echo "så læses DWG uden internet."
