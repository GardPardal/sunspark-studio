# WhatsApp operacional — reconstrução do zero

## Objetivo

Substituir o módulo atual por uma central de atendimento rápida e confiável, capaz de receber mensagens em tempo real, responder clientes pelo Solar OS, enviar arquivos e áudios, acompanhar entrega/leitura e preparar a Liz para atendimento automático controlado.

A reconstrução preservará credenciais, contatos, conversas e mensagens reais. O fluxo antigo ficará isolado como fallback técnico até a validação final, conforme a regra “nunca remover, sempre somar”.

## Resultado esperado

- Inbox real em desktop e celular, sem dados, fotos, contadores ou documentos fictícios.
- Mensagens novas aparecem em tempo real e uma única vez.
- Respostas enviadas pelo sistema chegam ao cliente e mostram estado real: enviando, enviada, entregue, lida ou falhou.
- Falhas nunca aparecem como sucesso; haverá nova tentativa manual.
- Atendimento humano pode assumir, devolver à Liz ou encerrar a conversa.
- Liz automática somente dentro dos limites definidos; negociação, temas sensíveis, baixa confiança e pedido de pessoa são transferidos ao humano.
- Dados do contato e do lead ficam disponíveis ao lado da conversa, inclusive vínculo com o CRM/Ploomes quando existente.

## Implementação

### 1. Núcleo único de mensagens

- Consolidar recepção, normalização, deduplicação, persistência e atualização das conversas em um único serviço interno.
- Tornar a Z-API o adaptador ativo de transporte, usando apenas variáveis protegidas já configuradas.
- Remover chaves e números fixos do código; nenhuma credencial será apagada do ambiente.
- Manter o adaptador Meta e o módulo anterior sem uso no fluxo principal, disponíveis como fallback até aprovação.
- Registrar o evento bruto antes do processamento para permitir reprocessamento seguro.
- Garantir idempotência pelo identificador do provedor e tratar corretamente texto, imagem, documento, áudio, vídeo e status.

### 2. Banco, segurança e tempo real

- Reutilizar `wa_channels`, `wa_contacts`, `wa_conversations`, `wa_messages`, `wa_events`, `wa_media`, `wa_consents` e `wa_audit_log` como fonte única.
- Criar somente os campos, índices e restrições que estiverem faltando, sem apagar conteúdo atual.
- Restringir cada função à organização do usuário autenticado; eliminar leituras administrativas sem validação de organização.
- Validar o callback da Z-API com o token/header configurado e rejeitar chamadas inválidas.
- Manter mensagens e conversas publicadas em tempo real e adicionar recuperação por atualização periódica leve caso a conexão caia.
- Corrigir contagem de não lidas, marcação como lida, vínculo de contato e ordenação pelo último evento.

### 3. Envio confiável

- Persistir primeiro uma mensagem em estado `sending`, enviar pela Z-API e atualizar com o identificador e estado retornados.
- Em falha, registrar `failed`, mostrar o motivo de forma segura e permitir reenviar.
- Não alternar silenciosamente entre provedores para o mesmo número.
- Enviar imagens, documentos, vídeos e áudios reais pelo armazenamento privado e URLs temporárias.
- Remover o gerador de PDF fictício e qualquer confirmação de sucesso antes da confirmação do provedor.

### 4. Nova interface operacional

- Dividir o monólito atual em componentes pequenos: lista, cabeçalho, histórico, bolha, composer, painel do contato e estados vazios/erro.
- Desktop: lista de conversas, conversa ativa e painel contextual recolhível.
- Mobile: navegação mestre-detalhe; ao abrir um chat, a lista sai da tela e aparece um botão voltar. Nada de rolagem horizontal.
- Busca por nome/telefone, filtros reais de não lidas, humano, Liz e encerradas, além de badges calculados do banco.
- Composer fixo com texto, anexos, gravação de áudio, respostas rápidas e envio por Enter.
- Estados claros para carregamento, offline, reconexão, conversa vazia, falha de envio e canal desconectado.
- Usar exclusivamente tokens Solar OS, Sora/Manrope e componentes do design system; sem cópia visual literal do WhatsApp Web.

### 5. Liz automática com limites

- Ativação controlada por canal, nunca por constante fixa no código.
- Responder automaticamente apenas dúvidas simples cobertas pela base, triagem inicial e coleta de dados permitida.
- Consultar contexto recente, base de conhecimento, dados do contato/lead e integrações comerciais existentes por ferramentas de leitura estreitas.
- Transferir para humano em negociação, preço fechado, contrato, prazo, reclamação, jurídico, baixa confiança ou pedido explícito.
- Antes de qualquer ação que altere CRM/Ploomes ou envie algo fora da conversa, exigir regra explícita e auditoria.
- Manter modo sombra e lista de teste para validação antes da liberação geral.

### 6. Migração sem perda

- Preservar todas as linhas reais existentes.
- Migrar apenas dados legítimos da tabela paralela antiga para o modelo `wa_*`, com deduplicação.
- Não tentar inventar ou reconstruir histórico que a Z-API não disponibiliza.
- Manter leitura de fallback temporária durante a validação; retirar apenas após aprovação explícita.

## Validação obrigatória

1. Callback de teste válido gera uma única mensagem e atualiza a lista em tempo real.
2. Callback inválido é rejeitado e não grava dados.
3. Texto enviado pela tela chega ao número de teste e percorre os estados reais.
4. Falha simulada aparece como falha e o reenvio funciona.
5. Imagem, PDF e áudio são enviados, recebidos e visualizados.
6. Não lidas zeram ao abrir a conversa e não voltam após recarregar.
7. Assumir atendimento pausa a Liz; devolver reativa; encerrar impede resposta automática.
8. Liz responde um caso simples e transfere negociação, tema sensível e baixa confiança.
9. Usuário de outra organização não consegue consultar nem alterar a conversa.
10. Testes responsivos em 390×844 e 1280×1800, sem sobreposição ou rolagem lateral.
11. Typecheck, lint, build e logs de runtime sem erros.

## Entrega em etapas

- **Etapa 1:** núcleo, segurança, banco e recepção em tempo real.
- **Etapa 2:** envio confiável e nova interface humana.
- **Etapa 3:** Liz em modo sombra/lista de teste, seguida de automação limitada após validação.

Nenhuma etapa seguinte será liberada sem a validação explícita da anterior.
