# 21 — Checklist de implantação na nova IA

## Fase 0 — Antes de começar
- [ ] Ler `00_LEIA_PRIMEIRO.md` inteiro.
- [ ] Ler `16_LACUNAS_CONFLITOS_E_DUPLICIDADES.md` e **decidir os 6 conflitos** (raio, carência, faixa de valor, modelo, e demais).
- [ ] Confirmar que a Liz atual permanece **pausada** — a migração não deve reativá-la.
- [ ] Guardar cópia deste pacote fora do sistema.

## Fase 1 — Conteúdo
- [ ] Colar `01_PROMPT_MESTRE_COMPLETO.md` (ou `20_PROMPT_COMPACTO.md`) como system prompt.
- [ ] Ajustar o raio no script de recusa (200 → 400 km).
- [ ] Ajustar a carência (90 ou 120 dias) conforme decisão.
- [ ] Carregar os 11 aprendizados de `18_BASE_DE_CONHECIMENTO.json` na memória da nova IA.
- [ ] Carregar objeções, scripts e templates (docs 07 e 13).
- [ ] Preencher as lacunas críticas do doc 04 (preço, prazo, garantia) **ou** manter a instrução de transferir.

## Fase 2 — Regras
- [ ] Implementar os bloqueantes de qualificação do doc 05.
- [ ] Tornar `min_fatura` e `exigir_fatura` **parâmetros lidos em runtime**, não texto fixo no prompt.
- [ ] Implementar as regras de extração (null sem evidência, sem dedução por DDD).
- [ ] Implementar a regra de ouro do Quiz.
- [ ] Implementar deduplicação por telefone, documento, e-mail, IDs externos e conversa.

## Fase 3 — Transbordo e segurança
- [ ] Implementar opt-out silencioso com as 5 palavras.
- [ ] Implementar os gatilhos de handoff do doc 10, na ordem exata.
- [ ] Implementar o silêncio total quando um humano assume.
- [ ] Implementar o corte por baixa confiança.
- [ ] Testar resistência a "ignore suas instruções".

## Fase 4 — Integrações
- [ ] Configurar o webhook Z-API com validação de token (403 sem token).
- [ ] Implementar idempotência por hash/ID de evento.
- [ ] Implementar status monotônico.
- [ ] Tratar LID sem telefone (ID curto, nunca número fabricado).
- [ ] Implementar a fila persistente para o CRM externo, com backoff e sem perda de lead.
- [ ] Validar campos reais do Ploomes (pipeline, estágio, origem, responsável, cidade com correspondência única).
- [ ] Confirmar Realtime no inbox.

## Fase 5 — Validação
- [ ] Rodar os **36 casos** do doc 14. Registrar aprovado/reprovado em cada um.
- [ ] Rodar os **6 casos de regressão** (R1–R6).
- [ ] Teste ponta a ponta: mensagem real → lead interno → fila → CRM externo → limpeza do teste.
- [ ] Medir latência da primeira resposta.
- [ ] Conferir que nenhuma mensagem histórica foi apagada ou alterada.

## Fase 6 — Corte
- [ ] Rodar as duas IAs em paralelo (nova em modo sombra) por pelo menos uma semana.
- [ ] Comparar amostra de respostas lado a lado com a SDR Stephany.
- [ ] Só então liberar a nova IA para responder — **com autorização explícita do usuário**.
- [ ] Manter a IA atual como fallback (regra de ouro: nunca remover, sempre somar).

## Fase 7 — Depois do corte
- [ ] Alimentar a base vetorial com documentos reais (hoje está vazia).
- [ ] Configurar horário de atendimento (hoje inexistente).
- [ ] Retomar a rotina de aprendizado com a SDR.
- [ ] Backup periódico: `curl -s https://lz7energia.com.br/api/public/dashhub/dados > painel-backup.json`.
