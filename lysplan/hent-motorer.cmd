@echo off
rem Henter DWG- og PDF-motoren ned i mappen vendor/, saa Lysplan ogsaa
rem virker uden internet. Koer en gang med netforbindelse. Kraever Node.
rem LibreDWG er GPL-3 - filerne bliver liggende lokalt hos dig.
setlocal
cd /d "%~dp0"
where npm >nul 2>nul
if not %errorlevel%==0 (
  echo Node/npm blev ikke fundet. Installer Node.js fra https://nodejs.org og proev igen.
  pause
  exit /b 1
)
if not exist vendor mkdir vendor
cd vendor

call :hent @mlightcad/libredwg-web 0.7.10 libredwg-web
call :hent pdfjs-dist 3.11.174 pdfjs-dist

echo.
echo Faerdig. Skriv stien vendor/libredwg-web/ i Lysplan under Tegninger - Avanceret.
pause
exit /b 0

:hent
echo Henter %1@%2 ...
call npm pack %1@%2 --silent >nul 2>nul
if not %errorlevel%==0 (echo   kunne ikke hentes & exit /b 0)
for /f "delims=" %%f in ('dir /b /o-d *.tgz') do set TGZ=%%f& goto :udpak
:udpak
if exist %3 rmdir /s /q %3
mkdir %3
tar -xzf "%TGZ%" -C %3 --strip-components=1
del /q "%TGZ%"
echo   lagt i vendor\%3
exit /b 0
