@echo off
rem Double-click this file to pull your latest YouTube videos into the site.
cd /d "%~dp0"
python fetch_videos.py
pause
