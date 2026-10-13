import { describe, expect, it } from "bun:test";
import { DateRange } from "../index.js";

const range = (start: string, end: string) => DateRange.create({ start, end }).unwrap();

describe("DateRange.create", () => {
  it("aceita Date ou string ISO", () => {
    const fromDates = DateRange.create({
      start: new Date("2026-01-01T08:00:00Z"),
      end: new Date("2026-01-01T12:00:00Z"),
    }).unwrap();

    expect(fromDates.equals(range("2026-01-01T08:00:00Z", "2026-01-01T12:00:00Z"))).toBe(true);
  });

  it("rejeita datas inválidas acumulando issues", () => {
    const result = DateRange.create({ start: "x", end: "y" });

    expect(result.isFail() && result.error.issues.map((i) => [i.field, i.code])).toEqual([
      ["start", "INVALID_DATE"],
      ["end", "INVALID_DATE"],
    ]);
  });

  it.each([
    ["2026-01-01T12:00:00Z", "2026-01-01T08:00:00Z"],
    ["2026-01-01T08:00:00Z", "2026-01-01T08:00:00Z"],
  ])("rejeita start %p >= end %p", (start, end) => {
    const result = DateRange.create({ start, end });

    expect(result.isFail() && result.error.issues[0]?.code).toBe("INVALID_DATE_RANGE");
  });

  it("start/end devolvem cópias (o VO não pode ser alterado por fora)", () => {
    const r = range("2026-01-01T08:00:00Z", "2026-01-01T12:00:00Z");
    r.start.setFullYear(2000);
    r.end.setFullYear(2000);

    expect(r.start.toISOString()).toBe("2026-01-01T08:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-01-01T12:00:00.000Z");
  });
});

describe("consultas", () => {
  const morning = range("2026-01-01T08:00:00Z", "2026-01-01T12:00:00Z");

  it("overlaps usa intervalo semiaberto [start, end)", () => {
    expect(morning.overlaps(range("2026-01-01T11:00:00Z", "2026-01-01T13:00:00Z"))).toBe(true);
    expect(morning.overlaps(range("2026-01-01T06:00:00Z", "2026-01-01T18:00:00Z"))).toBe(true);
    expect(morning.overlaps(range("2026-01-01T12:00:00Z", "2026-01-01T16:00:00Z"))).toBe(false);
    expect(morning.overlaps(range("2026-01-01T04:00:00Z", "2026-01-01T08:00:00Z"))).toBe(false);
  });

  it("contains inclui o início e exclui o fim", () => {
    expect(morning.contains(new Date("2026-01-01T08:00:00Z"))).toBe(true);
    expect(morning.contains(new Date("2026-01-01T11:59:59Z"))).toBe(true);
    expect(morning.contains(new Date("2026-01-01T12:00:00Z"))).toBe(false);
  });

  it("durationMs", () => {
    expect(morning.durationMs).toBe(4 * 60 * 60 * 1000);
  });

  it("serializa como ISO", () => {
    expect(JSON.parse(JSON.stringify(morning))).toEqual({
      start: "2026-01-01T08:00:00.000Z",
      end: "2026-01-01T12:00:00.000Z",
    });
  });
});
