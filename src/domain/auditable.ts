/**
 * Campos de auditoria opcionais. Estenda nas props das entidades que precisarem; a base
 * `Entity` não os impõe.
 */
export interface Auditable {
  createdAt: Date;
  updatedAt: Date;
  /** Preenchido em exclusão lógica (soft delete). */
  deletedAt?: Date | null;
}
