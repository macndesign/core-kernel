import { afterEach, describe, expect, it } from "bun:test";
import { AggregateRoot, createDomainEvent, Entity, UniqueId } from "../../domain/index.js";
import { NotFoundError, ValidationError } from "../../errors/index.js";
import { Result } from "../../result/index.js";
import {
  assertFail,
  assertOk,
  FixedClock,
  InMemoryEventPublisher,
  InMemoryRepository,
  SequentialIdGenerator,
} from "../index.js";

class TaskId extends UniqueId {
  declare private readonly __brand: "TaskId";
}

class Task extends Entity<{ title: string; done: boolean }, TaskId> {
  static restore(title: string, id: TaskId, done = false) {
    return new Task({ title, done }, id);
  }

  get title() {
    return this.props.title;
  }

  get done() {
    return this.props.done;
  }
}

/** Exemplo de repositório com query própria, como os do shift-swap. */
class InMemoryTaskRepository extends InMemoryRepository<Task> {
  async findPending(): Promise<Task[]> {
    return this.filter((task) => !task.done);
  }

  async findByTitle(title: string): Promise<Task | null> {
    return this.find((task) => task.title === title);
  }
}

const id = (value: string) => TaskId.from(value).unwrap();

describe("InMemoryRepository", () => {
  it("cria, busca, atualiza e remove", async () => {
    const repository = new InMemoryRepository<Task>();
    const task = Task.restore("a", id("1"));

    await repository.create(task);
    expect(await repository.findById(id("1"))).toBe(task);

    await repository.update(Task.restore("b", id("1")));
    expect((await repository.findById(id("1")))?.title).toBe("b");

    await repository.delete(id("1"));
    expect(await repository.findById(id("1"))).toBeNull();
  });

  it("create lança para id duplicado (como uma unique constraint)", async () => {
    const repository = new InMemoryRepository<Task>([Task.restore("a", id("1"))]);

    await expect(repository.create(Task.restore("b", id("1")))).rejects.toThrow("already exists");
  });

  it("update lança para entidade inexistente", async () => {
    const repository = new InMemoryRepository<Task>();

    await expect(repository.update(Task.restore("a", id("1")))).rejects.toThrow("does not exist");
  });

  it("delete de id inexistente não faz nada", async () => {
    const repository = new InMemoryRepository<Task>();

    await expect(repository.delete(id("x"))).resolves.toBeUndefined();
  });

  it("aceita dados iniciais e expõe items e size para asserções", () => {
    const repository = new InMemoryRepository<Task>([
      Task.restore("a", id("1")),
      Task.restore("b", id("2")),
    ]);

    expect(repository.size).toBe(2);
    expect(repository.items.map((task) => task.title)).toEqual(["a", "b"]);
  });

  it("seed e clear", () => {
    const repository = new InMemoryRepository<Task>();
    repository.seed(Task.restore("a", id("1")), Task.restore("b", id("2")));
    expect(repository.size).toBe(2);

    repository.clear();
    expect(repository.size).toBe(0);
  });

  it("subclasses implementam queries com find/filter", async () => {
    const repository = new InMemoryTaskRepository([
      Task.restore("a", id("1"), true),
      Task.restore("b", id("2")),
    ]);

    expect((await repository.findPending()).map((task) => task.title)).toEqual(["b"]);
    expect((await repository.findByTitle("a"))?.id.value).toBe("1");
    expect(await repository.findByTitle("z")).toBeNull();
  });

  it("failNext faz a próxima operação lançar (simula falha de infraestrutura)", async () => {
    const repository = new InMemoryRepository<Task>([Task.restore("a", id("1"))]);
    const error = new Error("connection refused");
    repository.failNext(error);

    await expect(repository.findById(id("1"))).rejects.toBe(error);
    expect(await repository.findById(id("1"))).not.toBeNull();
  });

  it.each([
    ["create", (r: InMemoryRepository<Task>) => r.create(Task.restore("x", id("9")))],
    ["update", (r: InMemoryRepository<Task>) => r.update(Task.restore("x", id("1")))],
    ["delete", (r: InMemoryRepository<Task>) => r.delete(id("1"))],
  ] as const)("failNext vale para %s", async (_name, operation) => {
    const repository = new InMemoryRepository<Task>([Task.restore("a", id("1"))]);
    repository.failNext(new Error("boom"));

    await expect(operation(repository)).rejects.toThrow("boom");
  });
});

describe("FixedClock", () => {
  it("devolve sempre a data configurada (como cópia)", () => {
    const clock = new FixedClock("2026-01-01T00:00:00Z");
    clock.now().setFullYear(2000);

    expect(clock.now().toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("set e advance movem o tempo", () => {
    const clock = new FixedClock(new Date("2026-01-01T00:00:00Z"));
    clock.advance(60_000);
    expect(clock.now().toISOString()).toBe("2026-01-01T00:01:00.000Z");

    clock.set("2027-06-01T12:00:00Z");
    expect(clock.now().toISOString()).toBe("2027-06-01T12:00:00.000Z");
  });

  it("começa no instante atual quando não recebe data", () => {
    expect(Math.abs(new FixedClock().now().getTime() - Date.now())).toBeLessThan(1000);
  });
});

describe("SequentialIdGenerator", () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it("gera ids previsíveis com prefixo", () => {
    const generator = new SequentialIdGenerator("task");

    expect([generator.generate(), generator.generate()]).toEqual(["task-1", "task-2"]);
  });

  it("install troca o gerador do UniqueId e devolve a função de restauração", () => {
    restore = new SequentialIdGenerator().install();

    expect(TaskId.generate().value).toBe("id-1");
    expect(UniqueId.generate().value).toBe("id-2");
  });
});

describe("InMemoryEventPublisher", () => {
  it("guarda os eventos publicados", async () => {
    class Counter extends AggregateRoot<{ n: number }> {
      static create() {
        const counter = new Counter({ n: 0 }, UniqueId.generate());
        counter.addDomainEvent(
          createDomainEvent({
            name: "counter.created",
            aggregateId: counter.id.value,
            payload: {},
          }),
        );
        return counter;
      }
    }
    const publisher = new InMemoryEventPublisher();

    await publisher.publish(Counter.create().pullDomainEvents());

    expect(publisher.published.map((event) => event.name)).toEqual(["counter.created"]);
    expect(publisher.namesOf()).toEqual(["counter.created"]);

    publisher.clear();
    expect(publisher.published).toEqual([]);
  });
});

describe("assertOk / assertFail", () => {
  it("assertOk faz narrowing e não lança em sucesso", () => {
    const result: Result<number, NotFoundError> = Result.ok(1);
    assertOk(result);

    expect(result.value).toBe(1);
  });

  it("assertOk lança com o erro serializado em falha", () => {
    expect(() => assertOk(Result.fail(new NotFoundError("Task not found")))).toThrow(
      /Expected Ok.*NOT_FOUND.*Task not found/,
    );
  });

  it("assertFail faz narrowing e não lança em falha", () => {
    const result: Result<number, NotFoundError> = Result.fail(new NotFoundError("x"));
    assertFail(result);

    expect(result.error.kind).toBe("not_found");
  });

  it("assertFail lança em sucesso", () => {
    expect(() => assertFail(Result.ok(42))).toThrow(/Expected Fail.*42/);
  });

  it("descreve valores que JSON.stringify não serializa (BigInt)", () => {
    expect(() => assertFail(Result.ok(10n))).toThrow(/Expected Fail, got Ok: 10/);
  });

  it("assertFail confere o code do erro ou de uma issue de validação", () => {
    const validation = Result.fail(
      new ValidationError({ field: "email", code: "INVALID_EMAIL", message: "invalid" }),
    );

    expect(() => assertFail(validation, "VALIDATION_FAILED")).not.toThrow();
    expect(() => assertFail(validation, "INVALID_EMAIL")).not.toThrow();
    expect(() => assertFail(validation, "TOO_SHORT")).toThrow(/Expected code TOO_SHORT/);
    expect(() => assertFail(Result.fail(new NotFoundError("x")), "NOT_FOUND")).not.toThrow();
  });
});
