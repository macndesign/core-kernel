import type { Clock } from "../application/ports/clock.js";

/** `Clock` controlado pelo teste. Parado até `set`/`advance`. */
export class FixedClock implements Clock {
  #time: number;

  constructor(initial: Date | string = new Date()) {
    this.#time = new Date(initial).getTime();
  }

  now(): Date {
    return new Date(this.#time);
  }

  set(date: Date | string): void {
    this.#time = new Date(date).getTime();
  }

  advance(ms: number): void {
    this.#time += ms;
  }
}
