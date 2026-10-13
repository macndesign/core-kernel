import { describe, expect, it } from "bun:test";
import { Entity, UniqueId } from "../../domain/index.js";
import { NotFoundError, type UnexpectedError } from "../../errors/index.js";
import { Result } from "../../result/index.js";
import {
  BaseUseCase,
  type CrudRepository,
  type FindByIdRepository,
  type UseCase,
} from "../index.js";

class TaskId extends UniqueId {
  declare private readonly __brand: "TaskId";
}

class Task extends Entity<{ title: string }, TaskId> {
  static restore(title: string, id: TaskId) {
    return new Task({ title }, id);
  }

  get title() {
    return this.props.title;
  }
}

class MapTaskRepository implements CrudRepository<Task> {
  readonly items = new Map<string, Task>();
  failWith: Error | undefined;

  async create(task: Task) {
    this.items.set(task.id.value, task);
  }

  async update(task: Task) {
    this.items.set(task.id.value, task);
  }

  async delete(id: TaskId) {
    this.items.delete(id.value);
  }

  async findById(id: TaskId) {
    if (this.failWith) throw this.failWith;
    return this.items.get(id.value) ?? null;
  }
}

class GetTaskTitle extends BaseUseCase<{ id: TaskId }, string, NotFoundError> {
  constructor(private readonly tasks: FindByIdRepository<Task>) {
    super();
  }

  protected async handle({ id }: { id: TaskId }): Promise<Result<string, NotFoundError>> {
    const task = await this.tasks.findById(id);
    if (!task) return Result.fail(new NotFoundError("Task not found", { code: "TASK_NOT_FOUND" }));
    return Result.ok(task.title);
  }
}

const sut = () => {
  const repository = new MapTaskRepository();
  const id = TaskId.from("t-1").unwrap();
  repository.items.set(id.value, Task.restore("Write tests", id));
  return { repository, id, useCase: new GetTaskTitle(repository) };
};

describe("BaseUseCase", () => {
  it("devolve o Result do handle em sucesso", async () => {
    const { useCase, id } = sut();

    expect((await useCase.execute({ id })).unwrap()).toBe("Write tests");
  });

  it("devolve as falhas esperadas do handle", async () => {
    const { useCase } = sut();
    const result = await useCase.execute({ id: TaskId.from("missing").unwrap() });

    expect(result.isFail() && result.error.code).toBe("TASK_NOT_FOUND");
  });

  it("converte exceções de infraestrutura em UnexpectedError", async () => {
    const { useCase, repository, id } = sut();
    const dbError = new Error("connection refused");
    repository.failWith = dbError;

    const result = await useCase.execute({ id });

    expect(result.isFail() && result.error.kind).toBe("unexpected");
    expect(result.isFail() && result.error.cause).toBe(dbError);
  });

  it("o tipo de erro inclui UnexpectedError", async () => {
    const { useCase, id } = sut();
    const result: Result<string, NotFoundError | UnexpectedError> = await useCase.execute({ id });

    expect(result.isOk()).toBe(true);
  });

  it("implementa o contrato UseCase", () => {
    const useCase: UseCase<{ id: TaskId }, string, NotFoundError | UnexpectedError> = sut().useCase;

    expect(typeof useCase.execute).toBe("function");
  });
});

describe("UseCase sem input", () => {
  it("pode ser chamado sem argumentos quando I é void", async () => {
    const ping: UseCase<void, string, never> = { execute: async () => Result.ok("pong") };

    expect((await ping.execute()).unwrap()).toBe("pong");
  });
});

describe("ports de repositório", () => {
  it("usam o tipo de id da entidade", async () => {
    const { repository } = sut();

    // @ts-expect-error findById exige TaskId, não string
    await repository.findById("t-1").catch(() => null);
    expect(repository.items.size).toBe(1);
  });

  it("CrudRepository cobre create, update, delete e findById", async () => {
    const repository: CrudRepository<Task> = new MapTaskRepository();
    const id = TaskId.generate();

    await repository.create(Task.restore("a", id));
    await repository.update(Task.restore("b", id));
    expect((await repository.findById(id))?.title).toBe("b");

    await repository.delete(id);
    expect(await repository.findById(id)).toBeNull();
  });
});
