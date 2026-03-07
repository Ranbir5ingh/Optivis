export type DomainErrorKind =
  | 'not_found'
  | 'already_exists'
  | 'conflict'
  | 'validation'
  | 'forbidden'
  |'unauthorized'
  | 'unexpected';

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly kind: DomainErrorKind = 'unexpected',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
