@echo off
rem Double-click to preview the site at http://localhost:8000 (close this window to stop).
rem A local server is needed because YouTube's embedded player won't play on pages opened as files.
cd /d "%~dp0"
start "" http://localhost:8000
python -m http.server 8000
