#!/bin/sh
# Starter Lysplan i en lille lokal webserver og aabner browseren.
# Kør:  ./start-lysplan.sh     (eller dobbeltklik på macOS efter chmod +x)
cd "$(dirname "$0")" || exit 1
PORT=${PORT:-8123}

aabn() {
  ( sleep 1
    if command -v open >/dev/null 2>&1; then open "http://localhost:$PORT/"
    elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:$PORT/"
    fi ) &
}

echo "Lysplan kører på http://localhost:$PORT/  (Ctrl+C stopper)"
if command -v python3 >/dev/null 2>&1; then aabn; exec python3 -m http.server "$PORT"; fi
if command -v python >/dev/null 2>&1; then aabn; exec python -m SimpleHTTPServer "$PORT"; fi
if command -v node >/dev/null 2>&1; then aabn; exec npx --yes http-server -p "$PORT" -c-1; fi

echo "Hverken Python eller Node blev fundet - åbner filen direkte."
if command -v open >/dev/null 2>&1; then open index.html; else xdg-open index.html; fi
