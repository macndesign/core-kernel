---
name: ddd-domain-service
description: Criar ou revisar serviços de domínio com o core-kernel. Usar quando uma regra de negócio envolver vários agregados/entidades ou VOs e não pertencer naturalmente a nenhum deles — políticas, calculadoras, verificações de conflito (ex.: sobreposição de horários, cálculo de preço/saldo, permissões) — ou quando o pedido citar "domain service", "serviço de domínio", "policy", "calculator", arquivos *.service.ts no core.
---

# Domain Service (core-kernel)

## Overview

Serviço de domínio é uma regra de negócio **pura** que não cabe em uma única entidade ou VO:
recebe objetos de domínio já carregados e devolve uma decisão ou um cálculo. Não faz I/O.

## Guidelines

- Ler `references/domain-service-pattern.md` antes de criar.
- Primeiro tentar colocar a regra numa entidade ou VO; serviço só quando a regra precisa de
  vários objetos que nenhum deles deveria conhecer.
- Nome da regra, não do técnico: `ShiftConflictPolicy`, `PriceCalculator`, `TransferPolicy`.
- **Sem I/O**: não recebe repositórios, clients, `Clock` nem env; o use case carrega os dados e
  passa por parâmetro (inclusive `now`).
- Funções puras ou classe sem estado; entradas e saídas tipadas com objetos do domínio.
- Devolver `Result<..., ConflictError | ValidationError>` quando a regra pode reprovar com
  motivo; `boolean`/valor quando é só uma consulta/cálculo.
- Determinístico: mesma entrada, mesma saída — testável sem dublês.

## Workflow

1. Confirmar que a regra não pertence a uma entidade/VO.
2. Definir a assinatura com objetos de domínio e o tipo de saída.
3. Implementar sem dependências de infraestrutura.
4. No use case: carregar os dados pelas ports, chamar o serviço, agir sobre o resultado.
5. Testar casos normais, limites e vazios diretamente (sem mocks).

## References

`references/domain-service-pattern.md`: política com `Result`, calculadora, uso no use case,
testes e armadilhas.
