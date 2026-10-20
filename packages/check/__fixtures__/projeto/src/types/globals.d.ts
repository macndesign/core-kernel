// O tsconfig das fixtures não carrega @types/node nem DOM.
declare const console: { log(...data: unknown[]): void; error(...data: unknown[]): void };
