@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Dependency belum terpasang. Menjalankan npm.cmd install...
  call npm.cmd install
  if errorlevel 1 (
    echo Gagal memasang dependency.
    pause
    exit /b 1
  )
)
if "%ADMIN_PASSWORD%"=="" (
  set /p ADMIN_PASSWORD=Masukkan password admin untuk sesi ini: 
)
if "%ADMIN_PASSWORD%"=="" (
  echo Password admin wajib diisi.
  pause
  exit /b 1
)
echo Menjalankan SIAPP PTN di http://localhost:3000
node server.js
pause
