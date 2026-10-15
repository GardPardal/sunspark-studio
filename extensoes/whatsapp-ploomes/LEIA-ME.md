# LZ7 · WhatsApp → Ploomes (extensão do Chrome)

Botão **"⚡ Cadastrar no Ploomes"** dentro do WhatsApp Web. Abre o formulário da SDR do Solar OS
(`/sdr-leadqualified`) já com nome e telefone da conversa aberta. O formulário:
- mostra de qual campanha/conjunto/anúncio a pessoa veio (pelo telefone, via Z-API) e já marca "Tráfego pago";
- deixa escolher o **Responsável**, filial, produto e gasto;
- cria o card no **Comercial / Energia Solar → Qualificação do Lead**;
- envia a conversão para a Meta (pixel + API de Conversões).

## Instalar (uma vez por computador)
1. Copie a pasta `whatsapp-ploomes` para o computador da SDR.
2. Chrome → `chrome://extensions` → ligue **Modo do desenvolvedor** (canto superior direito).
3. **Carregar sem compactação** → escolha a pasta `whatsapp-ploomes`.
4. Entre no Solar OS (lz7energia.com.br) com o login da SDR no mesmo Chrome.
5. Abra web.whatsapp.com, abra uma conversa: o botão aparece no canto inferior direito.

## Aba anônima
1. `chrome://extensions` → **Detalhes** da extensão → ligue **Permitir no modo de navegação anônima**.
2. Na janela anônima, entre no WhatsApp Web e no Solar OS (lz7energia.com.br) com o login da SDR — a janela
   anônima não usa os logins da janela normal. O formulário abre também numa janela anônima.

## Observações
- Se o WhatsApp não mostrar o número (contato com privacidade), o botão avisa e a SDR digita o telefone no formulário.
- Não lê nem envia mensagens: só pega nome e telefone da conversa aberta quando a SDR clica.
