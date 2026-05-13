export interface QueryReader {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface QueryOneReader {
  queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
}

export interface CommandExecutor {
  execute(sql: string, params?: unknown[]): Promise<void>;
}

export type TransactionHandle = QueryReader & QueryOneReader & CommandExecutor;

export type TenantSession = {
  entityId: string;
  userEmail: string;
  role: string;
};

export type RepositoryContext = {
  tenancy: TenantSession;
  requestId?: string;
};

export type TenantScopedRepository<TReader = TransactionHandle> = {
  readonly context: RepositoryContext;
  readonly reader: TReader;
};
