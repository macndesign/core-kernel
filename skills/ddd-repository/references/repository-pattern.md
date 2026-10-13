# Repository: padrões

Exemplo com um agregado `Booking` (reserva de sala):

```ts
// file: booking.ts
import { AggregateRoot, type Result, UniqueId, type ValidationError } from "core-kernel";
import { DateRange } from "core-kernel/vo";

export class BookingId extends UniqueId {
  declare private readonly __brand: "BookingId";
}

export interface BookingProps {
  roomId: string;
  period: DateRange;
  cancelled: boolean;
}

export class Booking extends AggregateRoot<BookingProps, BookingId> {
  private constructor(props: BookingProps, id: BookingId) {
    super(props, id);
  }

  static create(input: { roomId: string; start: string; end: string }): Result<Booking, ValidationError> {
    return DateRange.create(input).map(
      (period) => new Booking({ roomId: input.roomId, period, cancelled: false }, BookingId.generate()),
    );
  }

  static restore(props: BookingProps, id: BookingId): Booking {
    return new Booking(props, id);
  }

  get roomId(): string {
    return this.props.roomId;
  }

  get period(): DateRange {
    return this.props.period;
  }

  get cancelled(): boolean {
    return this.props.cancelled;
  }
}
```

## Port (no core)

```ts
// file: booking.repository.ts
import type { CreateRepository, FindByIdRepository, UpdateRepository } from "core-kernel";
import type { Booking } from "./booking.js";

/**
 * Só o que os use cases usam: sem delete (reservas são canceladas, não apagadas).
 * O método extra existe porque CreateBookingUseCase precisa checar conflito de horário.
 */
export interface BookingRepository
  extends CreateRepository<Booking>,
    UpdateRepository<Booking>,
    FindByIdRepository<Booking> {
  findActiveByRoom(roomId: string): Promise<Booking[]>;
}
```

## Mapper (na infraestrutura)

```ts
// file: booking.mapper.ts
import type { Mapper } from "core-kernel";
import { DateRange } from "core-kernel/vo";
import { Booking, BookingId } from "./booking.js";

/** Formato da linha no banco: primitivos e nomes do banco. */
export interface BookingRow {
  id: string;
  room_id: string;
  starts_at: Date;
  ends_at: Date;
  cancelled: boolean;
}

/**
 * Dados do banco são confiáveis: unwrap() só lança com dado corrompido, e essa exceção vira
 * UnexpectedError no BaseUseCase.
 */
export const bookingMapper: Mapper<Booking, BookingRow> = {
  toDomain: (row) =>
    Booking.restore(
      {
        roomId: row.room_id,
        period: DateRange.create({ start: row.starts_at, end: row.ends_at }).unwrap(),
        cancelled: row.cancelled,
      },
      BookingId.from(row.id).unwrap(),
    ),
  fromDomain: (booking) => ({
    id: booking.id.value,
    room_id: booking.roomId,
    starts_at: booking.period.start,
    ends_at: booking.period.end,
    cancelled: booking.cancelled,
  }),
};
```

## Adapter (na infraestrutura)

O client abaixo representa o driver/ORM do projeto (Prisma, Drizzle, `pg`...). O ponto é a
forma: recebe/devolve agregados, converte com o mapper e deixa exceções de infraestrutura
subirem.

```ts
// file: sql-booking.repository.ts
import type { EntityId } from "core-kernel";
import type { Booking } from "./booking.js";
import { type BookingRow, bookingMapper } from "./booking.mapper.js";
import type { BookingRepository } from "./booking.repository.js";

export interface SqlClient {
  query<T>(sql: string, params: unknown[]): Promise<T[]>;
}

export class SqlBookingRepository implements BookingRepository {
  constructor(private readonly db: SqlClient) {}

  async create(booking: Booking): Promise<void> {
    const row = bookingMapper.fromDomain(booking);
    await this.db.query("INSERT INTO bookings (id, room_id, starts_at, ends_at, cancelled) VALUES ($1, $2, $3, $4, $5)", [
      row.id,
      row.room_id,
      row.starts_at,
      row.ends_at,
      row.cancelled,
    ]);
  }

  async update(booking: Booking): Promise<void> {
    const row = bookingMapper.fromDomain(booking);
    await this.db.query("UPDATE bookings SET starts_at = $2, ends_at = $3, cancelled = $4 WHERE id = $1", [
      row.id,
      row.starts_at,
      row.ends_at,
      row.cancelled,
    ]);
  }

  async findById(id: EntityId<Booking>): Promise<Booking | null> {
    const [row] = await this.db.query<BookingRow>("SELECT * FROM bookings WHERE id = $1", [id.value]);
    return row ? bookingMapper.toDomain(row) : null; // não encontrado = null, não erro
  }

  async findActiveByRoom(roomId: string): Promise<Booking[]> {
    const rows = await this.db.query<BookingRow>("SELECT * FROM bookings WHERE room_id = $1 AND cancelled = false", [roomId]);
    return rows.map(bookingMapper.toDomain);
  }
}
```

## Dublê em memória (testes)

```ts
// file: in-memory-booking.repository.ts
import { InMemoryRepository } from "core-kernel/testing";
import type { Booking } from "./booking.js";
import type { BookingRepository } from "./booking.repository.js";

export class InMemoryBookingRepository extends InMemoryRepository<Booking> implements BookingRepository {
  async findActiveByRoom(roomId: string): Promise<Booking[]> {
    return this.filter((booking) => booking.roomId === roomId && !booking.cancelled);
  }
}
```

## Testes

```ts
// file: booking.repository.test.ts
import { describe, expect, it } from "bun:test";
import { Booking } from "./booking.js";
import { bookingMapper } from "./booking.mapper.js";
import { InMemoryBookingRepository } from "./in-memory-booking.repository.js";

const booking = (roomId: string) =>
  Booking.create({ roomId, start: "2026-01-01T08:00:00Z", end: "2026-01-01T09:00:00Z" }).unwrap();

describe("bookingMapper", () => {
  it("ida e volta sem perder dados", () => {
    const original = booking("r-1");
    const restored = bookingMapper.toDomain(bookingMapper.fromDomain(original));

    expect(restored.equals(original)).toBe(true);
    expect(restored.period.equals(original.period)).toBe(true);
  });
});

describe("InMemoryBookingRepository", () => {
  it("findActiveByRoom filtra por sala", async () => {
    const repository = new InMemoryBookingRepository([booking("r-1"), booking("r-2")]);

    expect((await repository.findActiveByRoom("r-1")).map((b) => b.roomId)).toEqual(["r-1"]);
  });

  it("findById devolve null para id inexistente", async () => {
    const repository = new InMemoryBookingRepository();

    expect(await repository.findById(booking("r-1").id)).toBeNull();
  });
});
```

## Checklist

- [ ] Port no core, composta das interfaces do core-kernel, só com métodos usados.
- [ ] `findById` → `T | null`; escrita → `void`; infraestrutura lança.
- [ ] Ids tipados nas assinaturas.
- [ ] Métodos extras têm nome do domínio e devolvem agregados — ou `count`/`exists` usados por
      um comando para decidir uma regra.
- [ ] Mapper com `restore`; tipos do ORM não saem do adapter.
- [ ] Transação para gravações em várias tabelas do mesmo agregado.
- [ ] Dublê estende `InMemoryRepository`; mapper testado ida e volta.

## Armadilhas comuns

- Repositório devolvendo DTO ou linha do banco (isso é query).
- `Result` no contrato do repositório: duplica tratamento e esconde falhas de infra.
- `findAll()` genérico "para o futuro".
- Validar dados no `toDomain` com regras atuais (use `restore`).
- Métodos que alteram um campo isolado (`updateStatus`): salve o agregado inteiro com `update`.
