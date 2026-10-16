# LZ7 · WhatsApp → Ploomes (extensão do Chrome) · v1.3.0

Botão **"⚡ Cadastrar no Ploomes"** no cabeçalho da conversa do WhatsApp Web.

## Como a SDR usa
1. Chegou mensagem → abre a conversa → clica **⚡ Cadastrar no Ploomes**.
2. A extensão lê a conversa: nome, telefone, mensagens, fotos (fatura) e o **código do anúncio**
   "(cód. 7K2QX)" que a página-ponte `/whatsapp` põe na 1ª mensagem. Se a conversa for longa, ela sobe
   sozinha até achar o código e volta para o fim (o botão mostra "⏳ Procurando o anúncio…").
3. Abre o formulário da SDR (`/sdr-leadqualified`) ao lado, já preenchido: nome, cidade, conta, filial
   mais próxima e "Tráfego pago" quando veio de anúncio.
4. A SDR confere, escolhe o **Responsável** e clica **Registrar e Enviar para o Ploomes**. Pronto:
   - lead salvo no Solar OS;
   - card no Ploomes em **Comercial / Energia Solar → 💎 Qualificação do Lead** com o responsável escolhido
     (se o cliente já tem negócio aberto em outro funil, um novo é criado no Comercial);
   - **Lead** e **CompleteRegistration** na Meta (API de Conversões). Com o código do anúncio, vão com o
     fbclid/cookies/IP/navegador do clique do cliente → a Meta conta a conversão na campanha certa.
   - A tela de resultado mostra o nº do card e se o Lead foi ligado ao anúncio.

## Instalar (uma vez por computador)
1. Copie a pasta `whatsapp-ploomes` para o computador da SDR.
2. Chrome → `chrome://extensions` → ligue **Modo do desenvolvedor** (canto superior direito).
3. **Carregar sem compactação** → escolha a pasta `whatsapp-ploomes`.
4. Entre no Solar OS (lz7energia.com.br) com o login da SDR no mesmo Chrome.
5. Abra web.whatsapp.com e uma conversa: o botão aparece no cabeçalho, à esquerda dos ícones.

## Atualizar para uma versão nova
1. Substitua os arquivos da pasta pelos novos.
2. `chrome://extensions` → no cartão da extensão, clique no ↻ (recarregar).
3. **Atualize o WhatsApp Web (F5)**. Sem isso o botão mostra "↻ Atualize o WhatsApp (F5)".

## Aba anônima
1. `chrome://extensions` → **Detalhes** da extensão → ligue **Permitir no modo de navegação anônima**.
2. Na janela anônima, entre no WhatsApp Web e no Solar OS com o login da SDR. Se a sessão do Solar OS
   tiver expirado, o formulário pede login e volta sozinho para o cadastro com os dados da conversa.

## Problemas
- **Botão vermelho "↻ Atualize o WhatsApp (F5)"**: a extensão foi atualizada com o WhatsApp aberto. F5.
- **"✔ Aberto · digite o telefone"**: o WhatsApp não mostrou o número (contato com privacidade). Digite no
  formulário.
- **Resultado "⚠ Na fila"**: o Ploomes não respondeu; o Solar OS tenta de novo sozinho (Central de Leads →
  Fila Ploomes).
- Não envia mensagens. Só lê a conversa aberta quando a SDR clica.
