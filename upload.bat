@echo off
REM UPLOAD PARA GITHUB - Script Automático
REM Duplo clique para executar

echo.
echo ========================================
echo    🚀 UPLOAD PARA GITHUB
echo ========================================
echo.

REM Verificar se Git está instalado
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Git não está instalado!
    echo.
    echo Instale em: https://git-scm.com/download/win
    echo.
    pause
    exit /b
)

REM Mudar para diretório do script
cd /d "%~dp0"

echo 📝 Configurando Git...
git config --global user.name "Usuário"
git config --global user.email "seu-email@gmail.com"

echo.
echo 📦 Verificando repositório...
if not exist .git (
    echo Inicializando repositório...
    git init
    git remote add origin https://github.com/GardPardal/sunspark-studio.git
    git branch -M main
)

echo.
echo 📤 Adicionando arquivos...
git add .

echo.
echo 💾 Fazendo commit...
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a:%%b)
git commit -m "Atualizar: Documentação, Admin Panel e Scripts - %mydate% %mytime%"

echo.
echo 🚀 Enviando para GitHub...
git push -u origin main

echo.
echo ========================================
echo ✅ UPLOAD CONCLUÍDO!
echo ========================================
echo.
echo 💡 Vercel vai detectar automaticamente
echo 💡 Deploy começará em alguns minutos
echo.
echo 📊 Monitorar em: https://vercel.com/dashboard
echo.
pause
