# DTO: padrões

Entidade usada nos exemplos:

```ts
// file: product.ts
import { Entity, UniqueId } from "core-kernel";
import type { Money, Text } from "core-kernel/vo";

export class ProductId extends UniqueId {
  declare private readonly __brand: "ProductId";
}

export interface ProductProps {
  name: Text;
  price: Money;
  categoryId: string;
  active: boolean;
  createdAt: Date;
}

export class Product extends Entity<ProductProps, ProductId> {
  static restore(props: ProductProps, id: ProductId): Product {
    return new Product(props, id);
  }

  get name(): Text {
    return this.props.name;
  }

  get price(): Money {
    return this.props.price;
  }

  get categoryId(): string {
    return this.props.categoryId;
  }

  get active(): boolean {
    return this.props.active;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
```

## Input e Output de use case

```ts
// file: create-product.dto.ts
/** Como chega da borda: primitivos, preço decimal. O use case converte em VOs. */
export interface CreateProductInput {
  name: string;
  price: number;
  currency: string;
  categoryId: string;
}

/** O mínimo que o chamador precisa. */
export interface CreateProductOutput {
  productId: string;
}
```

## DTOs de leitura (lista e detalhe)

```ts
// file: product-read.dto.ts
import type { PaginatedInputDTO, PaginatedResultDTO } from "core-kernel";

/** Item de lista: só o que a tabela mostra. */
export interface ProductListItemDTO {
  id: string;
  name: string;
  formattedPrice: string;
  active: boolean;
}

/** Detalhe: enriquecido com dados de outros agregados (resolvidos na query). */
export interface ProductDetailsDTO {
  id: string;
  name: string;
  price: { amount: number; currency: string; formatted: string };
  category: { id: string; name: string };
  active: boolean;
  createdAt: string; // ISO
}

/** Filtros + paginação na mesma entrada. */
export interface FindProductsInput extends PaginatedInputDTO {
  search?: string;
  active?: boolean;
}

export type FindProductsOutput = PaginatedResultDTO<ProductListItemDTO>;
```

## Conversão explícita entidade → DTO

```ts
// file: product.dto-mapper.ts
import type { Product } from "./product.js";
import type { ProductDetailsDTO, ProductListItemDTO } from "./product-read.dto.js";

export const toProductListItemDTO = (product: Product): ProductListItemDTO => ({
  id: product.id.value,
  name: product.name.value,
  formattedPrice: product.price.format("pt-BR"),
  active: product.active,
});

export const toProductDetailsDTO = (
  product: Product,
  category: { id: string; name: string },
): ProductDetailsDTO => ({
  id: product.id.value,
  name: product.name.value,
  price: { amount: product.price.amount, currency: product.price.currency, formatted: product.price.format("pt-BR") },
  category,
  active: product.active,
  createdAt: product.createdAt.toISOString(),
});
```

## Testes

```ts
// file: product.dto-mapper.test.ts
import { describe, expect, it } from "bun:test";
import { Money, Text } from "core-kernel/vo";
import { Product, ProductId } from "./product.js";
import { toProductDetailsDTO, toProductListItemDTO } from "./product.dto-mapper.js";

const product = Product.restore(
  {
    name: Text.create("Dipirona 500mg").unwrap(),
    price: Money.create({ amount: 1290, currency: "BRL" }).unwrap(),
    categoryId: "c-1",
    active: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  },
  ProductId.from("p-1").unwrap(),
);

describe("conversão para DTO", () => {
  it("item de lista só com primitivos", () => {
    expect(toProductListItemDTO(product)).toEqual({
      id: "p-1",
      name: "Dipirona 500mg",
      formattedPrice: expect.stringMatching(/^R\$\s12,90$/),
      active: true,
    });
  });

  it("detalhe serializa datas como ISO e é JSON puro", () => {
    const dto = toProductDetailsDTO(product, { id: "c-1", name: "Analgésicos" });

    expect(dto.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
  });
});
```

## Checklist

- [ ] Tipo identificado (input, output, leitura) e nome revela a intenção.
- [ ] Só primitivos, arrays e outros DTOs; datas como ISO string na saída.
- [ ] Não estende entidade/props; sem tipos do ORM.
- [ ] Paginação com `PaginatedInputDTO`/`PaginatedResultDTO`.
- [ ] Conversão em função explícita e testada.

## Armadilhas comuns

- Devolver a entidade (ou `entity.props`) para a API.
- Um DTO "faz-tudo" usado para entrada e saída.
- DTO com VO dentro (`price: Money`): a borda não deveria conhecer o domínio.
- DTO espelhando a tabela do banco em vez da necessidade da tela.
