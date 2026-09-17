# 10 — Regras de transferência humana

Fonte: `src/lib/wa-orchestrator.server.ts:91-212`, manual §6.

## 1. Ordem de avaliação (a primeira que casar vence)

```text
1. opt-out            → não responde, encerra
2. canal desligado    → não responde
3. humano no controle → não responde
4. handoff            → responde a frase de transbordo e para
5. baixa confiança    → handoff em vez de enviar resposta
```

## 2. Opt-out (encerramento por vontade do cliente)

Palavras exatas: **`sair`, `parar`, `descadastrar`, `remover`, `stop`**.
Ação: grava consentimento negativo em `wa_consents`, marca a conversa, **não envia nenhuma resposta**.
Reversão: só com novo consentimento explícito.

## 3. Gatilho A — pedido explícito de humano

Termos detectados: "falar com humano", "atendente", "pessoa de verdade", "quero falar com alguém" (e variações).
Resposta oficial:
> "Claro! Já estou chamando a Stephany da nossa equipe para continuar com você por aqui. 🙂"

## 4. Gatilho B — tema sensível (transferência imediata, sem tentar resolver)

Termos monitorados: `advogad`, `process`, `procon`, `juridic`, `reclama`, `cancelar contrato`, `distrat`, `golpe`, `fraude`.
Resposta oficial:
> "Esse assunto eu prefiro passar direto para um especialista do time. Já estou encaminhando para a Stephany!"

## 5. Gatilho C — informação que a IA não possui

Preço fechado, contrato, prazo de obra, garantia, taxa de financiamento, potência definitiva.
Resposta oficial:
> "Deixa eu confirmar isso com o time pra não te passar informação errada. Já te retorno por aqui. 🙂"

## 6. Gatilho D — baixa confiança do modelo

Se a geração vier com confiança abaixo do limiar, o sistema **não envia** a resposta e converte em handoff. Silêncio é preferível a resposta errada.

## 7. Gatilho E — humano já assumiu

Conversa em `humano`, `humano_assumiu`, `humano_bloqueado` ou `encerrada`: a IA **não escreve nada**, mesmo que o cliente pergunte diretamente para ela. Só volta a atuar quando a conversa é devolvida explicitamente pela interface.

## 8. Destinatário

Todo transbordo vai para a **SDR Stephany Martins** e para o time comercial no inbox `/mod/whatsapp`. Não há roteamento por unidade implementado no transbordo da IA.

## 9. O que a IA nunca faz sozinha

- Fechar contrato ou emitir proposta formal.
- Alterar, cancelar ou distratar contrato.
- Tratar cobrança, inadimplência ou financeiro.
- Prestar suporte técnico de sistema já instalado.
- Prometer preço, prazo, garantia ou taxa.
- Responder assunto jurídico.

## 10. Registro

Todo handoff marca a conversa, fica visível no inbox e é auditável. Nenhuma mensagem do cliente é apagada em qualquer um desses caminhos.
