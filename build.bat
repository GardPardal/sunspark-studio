@echo off
REM Script de Build para Produção - Windows

echo.
echo ========================================
echo   Preparando site para Produção
echo ========================================
echo.

REM Verificar se bun está instalado
where bun >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Bun não encontrado. Tentando com npm...
    where npm >nul 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ npm também não encontrado.
        echo.
        echo Instale um deles:
        echo - Bun: https://bun.sh
        echo - Node.js (npm): https://nodejs.org
        exit /b 1
    )
    set PKG_MGR=npm
) else (
    set PKG_MGR=bun
)

echo ✅ Usando: %PKG_MGR%
echo.

REM Instalar dependências
echo [1/3] Instalando dependências...
call %PKG_MGR% install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Erro ao instalar dependências
    exit /b 1
)
echo ✅ Dependências instaladas

echo.
echo [2/3] Compilando para produção...
call %PKG_MGR% run build
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Erro ao compilar
    exit /b 1
)
echo ✅ Build concluído

echo.
echo [3/3] Verificando arquivos...
if exist "dist" (
    echo ✅ Pasta dist/ criada com sucesso
    dir /s /b dist | find /c /v "" > nul && (
        for /f %%A in ('dir /s /b dist ^| find /c /v ""') do echo   - %%A arquivos gerados
    )
) else (
    echo ❌ Pasta dist/ não foi criada
    exit /b 1
)

echo.
echo ========================================
echo   ✅ SITE PRONTO PARA UPLOAD!
echo ========================================
echo.
echo Próximos passos:
echo 1. Copie a pasta "dist/" para seu servidor
echo 2. Configure a variável SUPABASE_SERVICE_ROLE_KEY
echo 3. Execute: node dist/server/index.js
echo.
echo Para mais informações, veja DEPLOYMENT_GUIDE.md
echo.
pause
