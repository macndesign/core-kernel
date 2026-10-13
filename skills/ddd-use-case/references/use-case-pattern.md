# Use Case: padrões

Os exemplos usam um agregado `Task` mínimo:

```ts
// file: task.ts
import { AggregateRoot, ConflictError, createDomainEvent, type DomainEvent, Result, UniqueId, type ValidationError } from "core-kernel";
import { Text } from "core-kernel/vo";

export class TaskId extends UniqueId {
  declare private readonly __brand: "TaskId";
}

type TaskCompleted = DomainEvent<"task.completed", { completedAt: string }>;

export interface TaskProps {
  title: Text;
  done: boolean;
}

export class Task extends AggregateRoot<TaskProps, TaskId, TaskCompleted> {
  private constructor(props: TaskProps, id: TaskId) {
    super(props, id);
  }

  static create(title: string): Result<Task, ValidationError> {
    return Text.create(title, { field: "title", maxLength: 200 }).map(
      (value) => new Task({ title: value, done: false }, TaskId.generate()),
    );
  }

  static restore(props: TaskProps, id: TaskId): Task {
    return new Task(props, id);
  }

  get title(): string {
    return this.props.title.value;
  }

  get done(): boolean {
    return this.props.done;
  }

  complete(now: Date): Result<void, ConflictError> {
    if (this.props.done) return Result.fail(new ConflictError("Task already done", { code: "TASK_ALREADY_DONE" }));
    this.props.done = true;
    this.addDomainEvent(
      createDomainEvent({ name: "task.completed", aggregateId: this.id.value, occurredAt: now, payload: { completedAt: now.toISOString() } }),
    );
    return Result.ok();
  }
}
```

## Comando que cria

```ts
// file: create-task.usecase.ts
import { BaseUseCase, type CreateRepository, Result, type ValidationError } from "core-kernel";
import { Task } from "./task.js";

export interface CreateTaskInput {
  title: string;
}

export interface CreateTaskOutput {
  taskId: string;
}

export class CreateTaskUseCase extends BaseUseCase<CreateTaskInput, CreateTaskOutput, ValidationError> {
  constructor(private readonly tasks: CreateRepository<Task>) {
    super();
  }

  protected async handle(input: CreateTaskInput): Promise<Result<CreateTaskOutput, ValidationError>> {
    const task = Task.create(input.title);
    if (task.isFail()) return task;

    await this.tasks.create(task.value);
    return Result.ok({ taskId: task.value.id.value }); // saída é DTO, não a entidade
  }
}
```

## Comando que altera (carregar → domínio → persistir → publicar)

```ts
// file: complete-task.usecase.ts
import {
  BaseUseCase,
  type Clock,
  type ConflictError,
  type DomainEventPublisher,
  type FindByIdRepository,
  NotFoundError,
  Result,
  type UpdateRepository,
  type ValidationError,
} from "core-kernel";
import { type Task, TaskId } from "./task.js";

export interface CompleteTaskInput {
  taskId: string;
}

type CompleteTaskError = ValidationError | NotFoundError | ConflictError;

export class CompleteTaskUseCase extends BaseUseCase<CompleteTaskInput, void, CompleteTaskError> {
  constructor(
    private readonly tasks: FindByIdRepository<Task> & UpdateRepository<Task>,
    private readonly events: DomainEventPublisher,
    private readonly clock: Clock,
  ) {
    super();
  }

  protected async handle({ taskId }: CompleteTaskInput): Promise<Result<void, CompleteTaskError>> {
    const id = TaskId.from(taskId);
    if (id.isFail()) return id;

    const task = await this.tasks.findById(id.value);
    if (!task) return Result.fail(new NotFoundError("Task not found", { code: "TASK_NOT_FOUND" }));

    const completed = task.complete(this.clock.now()); // a regra mora na entidade
    if (completed.isFail()) return completed;

    await this.tasks.update(task);
    await this.events.publish(task.pullDomainEvents());
    return Result.ok();
  }
}
```

## Testes (`createSut` + dublês do core-kernel/testing)

```ts
// file: complete-task.usecase.test.ts
import { describe, expect, it } from "bun:test";
import { assertFail, assertOk, FixedClock, InMemoryEventPublisher, InMemoryRepository } from "core-kernel/testing";
import { CompleteTaskUseCase } from "./complete-task.usecase.js";
import { CreateTaskUseCase } from "./create-task.usecase.js";
import { Task } from "./task.js";

const createSut = () => {
  const task = Task.create("Write docs").unwrap();
  const tasks = new InMemoryRepository<Task>([task]);
  const events = new InMemoryEventPublisher();
  const clock = new FixedClock("2026-01-01T09:00:00Z");
  return { task, tasks, events, useCase: new CompleteTaskUseCase(tasks, events, clock) };
};

describe("CompleteTaskUseCase", () => {
  it("conclui, persiste e publica task.completed", async () => {
    const { task, tasks, events, useCase } = createSut();

    assertOk(await useCase.execute({ taskId: task.id.value }));
    expect((await tasks.findById(task.id))?.done).toBe(true);
    expect(events.published.map((e) => [e.name, e.payload])).toEqual([
      ["task.completed", { completedAt: "2026-01-01T09:00:00.000Z" }],
    ]);
  });

  it.each([
    ["", "INVALID_ID"],
    ["missing", "TASK_NOT_FOUND"],
  ])("taskId %p → %p", async (taskId, code) => {
    assertFail(await createSut().useCase.execute({ taskId }), code);
  });

  it("não conclui duas vezes nem publica de novo", async () => {
    const { task, events, useCase } = createSut();
    await useCase.execute({ taskId: task.id.value });

    assertFail(await useCase.execute({ taskId: task.id.value }), "TASK_ALREADY_DONE");
    expect(events.published).toHaveLength(1);
  });

  it("falha de infraestrutura vira UnexpectedError (execute não rejeita)", async () => {
    const { task, tasks, useCase } = createSut();
    tasks.failNext(new Error("connection refused"));

    assertFail(await useCase.execute({ taskId: task.id.value }), "UNEXPECTED");
  });
});

describe("CreateTaskUseCase", () => {
  it("devolve o id criado e rejeita título vazio", async () => {
    const tasks = new InMemoryRepository<Task>();
    const useCase = new CreateTaskUseCase(tasks);

    const created = await useCase.execute({ title: "Ship it" });
    assertOk(created);
    expect(tasks.items.map((t) => t.id.value)).toEqual([created.value.taskId]);
    assertFail(await useCase.execute({ title: "  " }), "EMPTY");
  });
});
```

## Checklist

- [ ] `BaseUseCase<Input, Output, união de erros>`; lógica em `handle`.
- [ ] Input/Output com primitivos (DTO); nunca devolver a entidade.
- [ ] Dependências = menores ports necessárias, injetadas no construtor.
- [ ] Ids/campos convertidos por fábricas; falhas propagadas com `return r`.
- [ ] `null` do repositório → `NotFoundError` com `code` específico.
- [ ] Regras no domínio; `Clock` para a hora atual.
- [ ] Persiste antes de publicar eventos.
- [ ] Testes: sucesso, cada `code` de falha, `failNext` e efeitos colaterais.

## Armadilhas comuns

- Regra de negócio no use case (`if (task.done) ...`) em vez de um método da entidade.
- Depender de `CrudRepository` inteiro quando só usa `findById` + `update`.
- Devolver `Result<Task>` para o controller: acopla a borda ao domínio.
- `new Date()` no use case: teste fica não determinístico.
- `try/catch` manual em volta de tudo: o `BaseUseCase` já faz isso.
- Use case chamando outro use case para reaproveitar regra: extraia a regra para o domínio.
