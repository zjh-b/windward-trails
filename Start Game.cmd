@echo off
cd /d "%~dp0"
python run_game.py
if errorlevel 1 pause
