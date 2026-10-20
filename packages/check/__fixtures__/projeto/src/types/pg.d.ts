// Trecho das tipagens de `@types/pg` usado pelas fixtures (sem instalar o pacote).
declare module "pg" {
  type QueryConfigValues<T> = T extends Array<infer U> ? T : never;
  export interface QueryResult<R> {
    rows: R[];
  }
  export class Pool {
    query<R = any, I = any[]>(text: string, values?: QueryConfigValues<I>): Promise<QueryResult<R>>;
  }
}
