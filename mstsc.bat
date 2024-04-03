setlocal

:check_connection
echo Checking network connection...
ping -n 1 8.8.8.8 > nul

if errorlevel 1 (
    echo Network connection not available, waiting...
    timeout /t 5 > nul
    goto check_connection
) else (
    echo Network connection is up.
)

echo Starting Remote Desktop Connection...
start mstsc.exe /f /v:192.168.1.41 /span /multimon

:end
echo Remote Desktop Connection has been initiated.