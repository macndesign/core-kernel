---
name: ddd-value-object
description: Criar, revisar ou usar Value Objects com o core-kernel. Usar quando o pedido envolver "value object", "objeto de valor", "VO", arquivos *.vo.ts, validação e normalização de atributos de domínio (e-mail, documento, dinheiro, período, código), VOs compostos, Guard, ou os VOs prontos de core-kernel/vo e core-kernel/vo/br (Email, Text, Url, Money, DateRange, StrongPassword, Cpf, Cnpj).
---

# Value Object (core-kernel)

## Overview

VO é um conceito do domínio definido pelo seu **valor**: imutável, sempre válido e comparado
por igualdade estrutural. No core-kernel ele estende `ValueObject<T>`, tem construtor privado e
uma fábrica `static create(raw): Result<Vo, ValidationError>`.

## Guidelines

- Ler `references/vo-pattern.md` antes de criar ou alterar VOs.
- **Antes de criar um VO, verificar os prontos**: `core-kernel/vo` (`Email`, `Text`, `Url`,
  `Money`, `DateRange`, `StrongPassword`) e `core-kernel/vo/br` (`Cpf`, `Cnpj`).
- Construtor `private`; validação e normalização só na fábrica `create`.
- Validar com `Guard` (`notEmpty`, `matches`, `inRange`, `integer`, `oneOf`...); usar
  `Guard.all` para acumular issues ou `flatMap` para parar na primeira falha.
- Aceitar `{ field }` (ou um parâmetro `field`) para que a issue aponte o campo real
  (`billingEmail`, `lines[2].sku`).
- Normalizar antes de validar (trim, maiúsculas, só dígitos) e guardar o valor normalizado.
- Expor getters derivados quando agregam valor (`email.domain`, `cpf.formatted`).
- Operações devolvem **novos** VOs (`money.add(other)`), nunca mutam.
- Não guardar instâncias de classes que não sejam VOs dentro do valor (comparação vira por
  referência).

## Workflow

1. Confirmar que não existe VO pronto (core-kernel ou no projeto) para o conceito.
2. Definir o tipo do valor (primitivo ou objeto) e as invariantes.
3. Implementar `create` com normalização + `Guard`, devolvendo `Result`.
4. Adicionar getters/operações de domínio necessários.
5. Testar: valor válido normalizado, cada invariante violada (pelo `code`), igualdade.

## References

`references/vo-pattern.md`: template, VO composto, uso dos VOs prontos, testes e armadilhas.
