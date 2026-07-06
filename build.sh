#!/bin/bash
# Script de Build para Produção - Linux/Mac

echo ""
echo "========================================"
echo "  Preparando site para Produção"
echo "========================================"
echo ""

# Verificar se bun está instalado
if ! command -v bun &> /dev/null; then
    echo "❌ Bun não encontrado. Tentando com npm..."
    if ! command -v npm &> /dev/null; then
        echo "❌ npm também não encontrado."
        echo ""
        echo "Instale um deles:"
        echo "- Bun: https://bun.sh"
        echo "- Node.js (npm): https://nodejs.org"
        exit 1
    fi
    PKG_MGR="npm"
else
    PKG_MGR="bun"
fi

echo "✅ Usando: $PKG_MGR"
echo ""

# Instalar dependências
echo "[1/3] Instalando dependências..."
$PKG_MGR install
if [ $? -ne 0 ]; then
    echo "❌ Erro ao instalar dependências"
    exit 1
fi
echo "✅ Dependências instaladas"

echo ""
echo "[2/3] Compilando para produção..."
$PKG_MGR run build
if [ $? -ne 0 ]; then
    echo "❌ Erro ao compilar"
    exit 1
fi
echo "✅ Build concluído"

echo ""
echo "[3/3] Verificando arquivos..."
if [ -d "dist" ]; then
    echo "✅ Pasta dist/ criada com sucesso"
    FILE_COUNT=$(find dist -type f | wc -l)
    echo "   - $FILE_COUNT arquivos gerados"
else
    echo "❌ Pasta dist/ não foi criada"
    exit 1
fi

echo ""
echo "========================================"
echo "   ✅ SITE PRONTO PARA UPLOAD!"
echo "========================================"
echo ""
echo "Próximos passos:"
echo "1. Copie a pasta 'dist/' para seu servidor"
echo "2. Configure a variável SUPABASE_SERVICE_ROLE_KEY"
echo "3. Execute: node dist/server/index.js"
echo ""
echo "Para mais informações, veja DEPLOYMENT_GUIDE.md"
echo ""
