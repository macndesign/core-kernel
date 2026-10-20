---
name: ddd-migration
description: Migrar um projeto existente (com Result, erros, Entity ou UseCase próprios, num "shared" ou "core") para o core-kernel, ou atualizar um consumidor para uma versão nova do core-kernel ou de uma lib de domínio feita com ele. Usar quando o pedido envolver "migrar para o core-kernel", "trocar o shared", "atualizar o core-kernel", incompatibilidades depois de um upgrade, ou adaptar rotas/adapters a use cases que passaram a devolver Result do core-kernel.
---

# Migração para o core-kernel

## Overview

Migrar é trocar a fundação sem mudar o comportamento. O compilador encontra a maior parte do
trabalho; o perigo está no que **continua compilando** e quebra em silêncio: id tipado indo
inteiro para o SQL, status HTTP decidido pelo texto do erro, `try/catch` que nunca dispara.
Esta skill é o playbook das migrações piloto (shift-swap e o backend que o usa).

## Guidelines

- Ler `references/migration-playbook.md` antes de começar.
- Migração **completa** por padrão: nada de camada de compatibilidade que reexporta os tipos
  antigos. Cada bloco antigo some quando o equivalente do core-kernel entra.
- Comportamento observável (respostas HTTP, corpo de erro, dados gravados) não muda sem decisão
  explícita do usuário. Se o contrato com um frontend precisa ficar igual, adapte na borda.
- Use o `tsc` como lista de tarefas e o `core-kernel-check` para o que o `tsc` não vê
  (CK001–CK008). Rode os dois até zerar.
- Depois de migrar, prove com um teste de ponta a ponta contra um banco descartável (PGlite,
  SQLite em memória, container): os bugs que compilam só aparecem com dados reais.
- Os padrões de destino estão nas outras skills (`ddd-result-errors`, `ddd-entity`,
  `ddd-use-case`, `ddd-repository`); esta skill cobre o caminho até eles.

## Workflow

1. **Inventário:** listar os blocos próprios (Result, erros, Entity, VO, UseCase, ports, ids)
   e onde são usados.
2. **Mapeamento:** montar a tabela antigo → core-kernel (ver a reference) e as decisões que
   dependem do usuário (idioma dos códigos de erro, o que os use cases devolvem).
3. **Troca:** instalar `core-kernel` (e `core-kernel-check` como devDependency), substituir os
   imports e apagar os blocos antigos.
4. **Compilar:** `tsc --noEmit` e corrigir até zerar.
5. **Riscos que compilam:** `bunx core-kernel-check` e a checklist da reference.
6. **Provar:** testes unitários + ponta a ponta com banco descartável; inspecionar os dados
   gravados (ids sem aspas, datas no formato certo).

## References

`references/migration-playbook.md`: tabela de mapeamento, a checklist dos riscos que compilam
(com o antes e o depois de cada um) e o roteiro do teste de ponta a ponta.
