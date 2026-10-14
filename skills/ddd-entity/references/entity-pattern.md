# Entity: padrões

## Template

```ts
// file: employee-id.ts
import { UniqueId } from "core-kernel";

/** Id tipado: o compilador não deixa passar outro tipo de id no lugar. */
export class EmployeeId extends UniqueId {
  declare private readonly __brand: "EmployeeId";
}
```

```ts
// file: employee.entity.ts
import {
  type Auditable,
  ConflictError,
  Entity,
  Guard,
  Result,
  type ValidationError,
} from "core-kernel";
import { Email, Text } from "core-kernel/vo";
import { EmployeeId } from "./employee-id.js";

export type EmployeeStatus = "active" | "inactive";

export interface EmployeeProps extends Auditable {
  name: Text;
  email: Email;
  weeklyHours: number;
  status: EmployeeStatus;
}

export interface CreateEmployeeInput {
  name: string;
  email: string;
  weeklyHours: number;
  /** Id externo opcional (ex.: id do provedor de autenticação). */
  id?: string;
}

export class Employee extends Entity<EmployeeProps, EmployeeId> {
  private constructor(props: EmployeeProps, id: EmployeeId) {
    super(props, id);
  }

  /** Valida tudo de uma vez (Result.combine acumula as issues de todos os campos). */
  static create(input: CreateEmployeeInput, now: Date): Result<Employee, ValidationError> {
    const fields = Result.combine([
      Text.create(input.name, { field: "name", maxLength: 120 }),
      Email.create(input.email),
      Employee.validateHours(input.weeklyHours),
      input.id === undefined ? Result.ok(EmployeeId.generate()) : EmployeeId.from(input.id),
    ]);
    if (fields.isFail()) return fields;

    const [name, email, , id] = fields.value;
    return Result.ok(
      new Employee(
        { name, email, weeklyHours: input.weeklyHours, status: "active", createdAt: now, updatedAt: now },
        id,
      ),
    );
  }

  /** Reidratação pelo repositório/mapper: dados já validados, sem regras. */
  static restore(props: EmployeeProps, id: EmployeeId): Employee {
    return new Employee(props, id);
  }

  get name(): Text {
    return this.props.name;
  }

  get email(): Email {
    return this.props.email;
  }

  get weeklyHours(): number {
    return this.props.weeklyHours;
  }

  get status(): EmployeeStatus {
    return this.props.status;
  }

  get isActive(): boolean {
    return this.props.status === "active";
  }

  /** Atualização reaproveita a mesma regra do create. */
  changeWeeklyHours(hours: number, now: Date): Result<void, ValidationError | ConflictError> {
    if (!this.isActive) {
      return Result.fail(new ConflictError("Employee is inactive", { code: "EMPLOYEE_INACTIVE" }));
    }
    // Efeito colateral: retorno antecipado, não `.map(() => { ... })`.
    const valid = Employee.validateHours(hours);
    if (valid.isFail()) return valid;

    this.props.weeklyHours = hours;
    this.props.updatedAt = now;
    return Result.ok();
  }

  deactivate(now: Date): Result<void, ConflictError> {
    if (!this.isActive) {
      return Result.fail(new ConflictError("Employee is already inactive", { code: "EMPLOYEE_INACTIVE" }));
    }
    this.props.status = "inactive";
    this.props.updatedAt = now;
    return Result.ok();
  }

  private static validateHours(hours: number): Result<void, ValidationError> {
    return Guard.integer(hours, { field: "weeklyHours" }).flatMap(() =>
      Guard.inRange(hours, { min: 1, max: 44 }, { field: "weeklyHours" }),
    );
  }
}
```

## Herança entre tipos de entidade

Quando tipos compartilham base e regras (ex.: pessoas com papéis diferentes), use uma classe
base `abstract` com construtor `protected` e fábricas nas subclasses — não um campo `role`
com `if`s espalhados.

```ts
// file: person.entity.ts
import { Entity, type Result, UniqueId, type ValidationError } from "core-kernel";
import { Email } from "core-kernel/vo";

export class PersonId extends UniqueId {
  declare private readonly __brand: "PersonId";
}

export interface PersonProps {
  email: Email;
}

export abstract class Person<P extends PersonProps = PersonProps> extends Entity<P, PersonId> {
  get email(): Email {
    return this.props.email;
  }

  protected static parseEmail(raw: string): Result<Email, ValidationError> {
    return Email.create(raw);
  }
}

export class Supervisor extends Person {
  private constructor(props: PersonProps, id: PersonId) {
    super(props, id);
  }

  static create(email: string): Result<Supervisor, ValidationError> {
    return Person.parseEmail(email).map((value) => new Supervisor({ email: value }, PersonId.generate()));
  }

  /** Regra exclusiva do supervisor. */
  canApprove(): boolean {
    return true;
  }
}
```

## Testes

```ts
// file: employee.entity.test.ts
import { describe, expect, it } from "bun:test";
import { assertFail, assertOk } from "core-kernel/testing";
import { EmployeeId } from "./employee-id.js";
import { Employee } from "./employee.entity.js";

const now = new Date("2026-01-01T00:00:00Z");
const valid = { name: "Ana", email: "ana@example.com", weeklyHours: 40 };

describe("Employee", () => {
  it("cria ativo, com id gerado e valores normalizados", () => {
    const employee = Employee.create({ ...valid, email: " ANA@example.com " }, now);

    assertOk(employee);
    expect(employee.value.isActive).toBe(true);
    expect(employee.value.email.value).toBe("ana@example.com");
  });

  it("aceita id externo", () => {
    expect(Employee.create({ ...valid, id: "auth|123" }, now).unwrap().id.value).toBe("auth|123");
  });

  it("acumula as issues de todos os campos", () => {
    const result = Employee.create({ name: "", email: "x", weeklyHours: 50 }, now);

    assertFail(result);
    expect(result.error.kind === "validation" && result.error.issues.map((i) => i.field)).toEqual([
      "name",
      "email",
      "weeklyHours",
    ]);
  });

  it("não altera carga horária de inativo", () => {
    const employee = Employee.create(valid, now).unwrap();
    assertOk(employee.deactivate(now));

    assertFail(employee.changeWeeklyHours(30, now), "EMPLOYEE_INACTIVE");
  });

  it("igualdade é por id", () => {
    const id = EmployeeId.from("e-1").unwrap();
    const a = Employee.create({ ...valid, id: id.value }, now).unwrap();
    const b = Employee.create({ ...valid, id: id.value, weeklyHours: 20 }, now).unwrap();

    expect(a.equals(b)).toBe(true);
  });
});
```

## Checklist

- [ ] Id tipado (`XxxId extends UniqueId` com brand).
- [ ] Construtor `private`/`protected`; `create` devolve `Result`; `restore` sem validação.
- [ ] Atributos com regra são VOs; `create` acumula issues (`Result.combine`/`Guard.all`).
- [ ] Getters para leitura; nenhum setter; `props` não vazam.
- [ ] Transições são métodos de domínio que devolvem `Result` com `code` específico.
- [ ] `now` recebido por parâmetro; nenhum `new Date()` em regra de negócio.
- [ ] Outras entidades referenciadas por id.

## Armadilhas comuns

- Validar em `restore`: dados antigos válidos na época podem quebrar a leitura.
- Usar `restore` fora de mappers/repositórios para "pular validação".
- Expor `props` ou um `toJSON` com tudo: a conversão para DTO deve ser explícita.
- Método genérico `update(props)` em vez de transições com nome do negócio.
- Mudar estado dentro de `result.map(() => { ... })`: `map` é para transformar valor. Para
  efeitos, use retorno antecipado (`if (r.isFail()) return r;` → altera → `return Result.ok()`).
  Além de mais claro, o lint `useIterableCallbackReturn` do Biome reprova o `map` sem retorno.
- Guardar a entidade relacionada inteira (`order.customer`) em vez do id (`order.customerId`).
