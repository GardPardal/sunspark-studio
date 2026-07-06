#!/bin/bash

# UPLOAD PARA GITHUB - Script Automático

cd "$(dirname "$0")"

echo "🚀 Iniciando upload para GitHub..."
echo ""

# Configurar Git (primeira vez)
echo "📝 Configurando Git..."
git config --global user.name "Usuário"
git config --global user.email "seu-email@gmail.com"

# Inicializar repo (se não tiver)
if [ ! -d .git ]; then
    echo "📦 Inicializando repositório..."
    git init
    git remote add origin https://github.com/GardPardal/sunspark-studio.git
    git branch -M main
fi

# Adicionar todos arquivos
echo "📤 Adicionando arquivos..."
git add .

# Commit
echo "💾 Fazendo commit..."
git commit -m "Atualizar: Documentação, Admin Panel e Scripts - $(date '+%Y-%m-%d %H:%M')"

# Push
echo "🚀 Enviando para GitHub..."
git push -u origin main

echo ""
echo "✅ PRONTO! Upload concluído!"
echo ""
echo "💡 Próximo passo: Vercel vai detectar e fazer deploy automático"
echo ""
echo "Monitorar em: https://vercel.com/dashboard"
echo ""
