/** Fonte de tempo. Injete nos use cases que dependem de "agora" para testá-los com datas fixas. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
