@echo off
cd /d "%~dp0"
echo Starting Karatina Loop...
echo Leave this window open while using the website.
echo When Vite says it is ready, open the exact Local URL it displays.
echo.
where pnpm >nul 2>nul
if %errorlevel%==0 (
  pnpm exec vite --host 127.0.0.1 --port 5173
) else (
  npm run dev -- --host 127.0.0.1 --port 5173
)
pause
