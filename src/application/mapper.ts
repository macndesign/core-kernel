/**
 * Converte entre o domínio e um formato externo (linha do banco, documento, payload).
 * `toDomain` normalmente usa o `restore` da entidade.
 */
export interface Mapper<Domain, Raw> {
  toDomain(raw: Raw): Domain;
  fromDomain(domain: Domain): Raw;
}
