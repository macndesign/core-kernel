import { ValueObject } from "../domain/value-object.js";
import { ValidationError, type ValidationIssue } from "../errors/validation-error.js";
import { Result } from "../result/result.js";
import { type VoOptions, withOverrides } from "./internal.js";

/** Códigos que `DateRange.create` pode gerar (chaves de `errors`). */
export type DateRangeErrorCode = "INVALID_DATE" | "INVALID_DATE_RANGE";

export interface DateRangeValue {
  start: Date;
  end: Date;
}

export interface DateRangeInput {
  start: Date | string;
  end: Date | string;
}

const toDate = (raw: Date | string): Date | null => {
  const date = raw instanceof Date ? new Date(raw.getTime()) : new Date(String(raw ?? ""));
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Intervalo semiaberto `[start, end)` com `start < end`. Ex.: turnos, reservas, vigências. */
export class DateRange extends ValueObject<DateRangeValue> {
  private constructor(value: DateRangeValue) {
    super(value);
  }

  /** `field` prefixa as issues (ex.: `periodo` → `periodo.start`, `periodo.end`). */
  static create(
    input: DateRangeInput,
    { field, errors }: VoOptions<DateRangeErrorCode> = {},
  ): Result<DateRange, ValidationError> {
    const name = (part: string) => (field ? `${field}.${part}` : part);
    const start = toDate(input.start);
    const end = toDate(input.end);
    const issues: ValidationIssue[] = [];
    if (!start)
      issues.push({ field: name("start"), code: "INVALID_DATE", message: "start is invalid" });
    if (!end) issues.push({ field: name("end"), code: "INVALID_DATE", message: "end is invalid" });
    if (start && end && start.getTime() >= end.getTime()) {
      issues.push({
        field: name("end"),
        code: "INVALID_DATE_RANGE",
        message: "end must be after start",
      });
    }
    if (issues.length > 0 || !start || !end) {
      return withOverrides(Result.fail(new ValidationError(issues)), errors);
    }
    return Result.ok(new DateRange({ start, end }));
  }

  /** Cópia: alterar a data devolvida não altera o VO. */
  get start(): Date {
    return new Date(this.value.start.getTime());
  }

  get end(): Date {
    return new Date(this.value.end.getTime());
  }

  get durationMs(): number {
    return this.value.end.getTime() - this.value.start.getTime();
  }

  /** Há interseção? Intervalos que só se tocam (fim de um = início do outro) não se sobrepõem. */
  overlaps(other: DateRange): boolean {
    return (
      this.value.start.getTime() < other.value.end.getTime() &&
      other.value.start.getTime() < this.value.end.getTime()
    );
  }

  contains(date: Date): boolean {
    const time = date.getTime();
    return this.value.start.getTime() <= time && time < this.value.end.getTime();
  }
}
