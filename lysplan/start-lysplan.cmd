@echo off
rem Starter Lysplan i en lille lokal webserver og aabner browseren.
rem Dobbeltklik paa filen - luk vinduet igen naar du er faerdig.
setlocal
cd /d "%~dp0"
set PORT=8123

where py >nul 2>nul
if %errorlevel%==0 goto python3
where python >nul 2>nul
if %errorlevel%==0 goto python
where node >nul 2>nul
if %errorlevel%==0 goto node
goto direkte

:python3
echo Lysplan koerer paa http://localhost:%PORT%/  (luk vinduet for at stoppe)
start "" http://localhost:%PORT%/
py -3 -m http.server %PORT%
goto slut

:python
echo Lysplan koerer paa http://localhost:%PORT%/  (luk vinduet for at stoppe)
start "" http://localhost:%PORT%/
python -m http.server %PORT%
goto slut

:node
echo Lysplan koerer paa http://localhost:%PORT%/  (luk vinduet for at stoppe)
start "" http://localhost:%PORT%/
npx --yes http-server -p %PORT% -c-1
goto slut

:direkte
echo Hverken Python eller Node blev fundet. Aabner filen direkte i browseren.
echo DWG og PDF kraever en server eller internet - se README.
start "" "%~dp0index.html"

:slut
endlocal
