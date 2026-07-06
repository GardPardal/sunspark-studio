# UPLOAD PARA GITHUB - Script Automático
# Duplo clique para executar

# Cores para output
$green = "`e[32m"
$blue = "`e[34m"
$reset = "`e[0m"

Write-Host "${blue}🚀 Iniciando upload para GitHub...${reset}" -ForegroundColor Cyan
Write-Host ""

# Verificar se Git está instalado
try {
    git --version | Out-Null
} catch {
    Write-Host "${green}❌ Git não está instalado!${reset}" -ForegroundColor Red
    Write-Host ""
    Write-Host "Instale Git em: https://git-scm.com/download/win"
    Write-Host ""
    pause
    exit
}

# Mudar para diretório do projeto
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectPath

# Configurar Git
Write-Host "${blue}📝 Configurando Git...${reset}" -ForegroundColor Cyan
git config --global user.name "Usuário"
git config --global user.email "seu-email@gmail.com"

# Inicializar repo se não tiver
if (!(Test-Path .git)) {
    Write-Host "${blue}📦 Inicializando repositório...${reset}" -ForegroundColor Cyan
    git init
    git remote add origin https://github.com/GardPardal/sunspark-studio.git
    git branch -M main
}

# Adicionar todos arquivos
Write-Host "${blue}📤 Adicionando arquivos...${reset}" -ForegroundColor Cyan
git add .

# Commit
Write-Host "${blue}💾 Fazendo commit...${reset}" -ForegroundColor Cyan
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
git commit -m "Atualizar: Documentação, Admin Panel e Scripts - $timestamp"

# Push
Write-Host "${blue}🚀 Enviando para GitHub...${reset}" -ForegroundColor Cyan
git push -u origin main

Write-Host ""
Write-Host "${green}✅ PRONTO! Upload concluído!${reset}" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Próximo passo: Vercel vai detectar e fazer deploy automático"
Write-Host ""
Write-Host "Monitorar em: https://vercel.com/dashboard"
Write-Host ""
pause
