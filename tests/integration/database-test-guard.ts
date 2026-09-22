type DatabaseTestEnvironment = Record<string, string | undefined>;

const DATABASE_TARGET_PARAMETERS = [
  'database',
  'dbname',
  'host',
  'hostaddr',
  'options',
  'port',
] as const;

function normalizeDatabaseTarget(value: string, variableName: string): string {
  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`${variableName} must be a valid PostgreSQL connection URL.`);
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error(`${variableName} must be a valid PostgreSQL connection URL.`);
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  } catch {
    throw new Error(`${variableName} must be a valid PostgreSQL connection URL.`);
  }

  if (!url.hostname || !databaseName) {
    throw new Error(`${variableName} must identify an explicit database target.`);
  }

  const targetParameters = DATABASE_TARGET_PARAMETERS.flatMap((name) =>
    url.searchParams
      .getAll(name)
      .map((parameterValue) => [name, parameterValue] as const),
  ).sort(([leftName, leftValue], [rightName, rightValue]) =>
    `${leftName}\0${leftValue}`.localeCompare(`${rightName}\0${rightValue}`),
  );

  return JSON.stringify({
    hostname: url.hostname.toLowerCase(),
    port: url.port || '5432',
    databaseName,
    targetParameters,
  });
}

export function requireIsolatedDatabaseUrl(environment: DatabaseTestEnvironment): string {
  const testDatabaseUrl = environment.TEST_DATABASE_URL?.trim();

  if (environment.ALLOW_DATABASE_TESTS !== 'true' || !testDatabaseUrl) {
    throw new Error(
      'Database integration tests are disabled. Set ALLOW_DATABASE_TESTS=true and TEST_DATABASE_URL to an isolated database target.',
    );
  }

  const currentDatabaseUrl = environment.DATABASE_URL?.trim();
  if (!currentDatabaseUrl) {
    throw new Error(
      'DATABASE_URL is required so TEST_DATABASE_URL can be verified against the current database target.',
    );
  }

  const currentTarget = normalizeDatabaseTarget(currentDatabaseUrl, 'DATABASE_URL');
  const testTarget = normalizeDatabaseTarget(testDatabaseUrl, 'TEST_DATABASE_URL');

  if (currentTarget === testTarget) {
    throw new Error(
      'TEST_DATABASE_URL must use an isolated database target distinct from DATABASE_URL.',
    );
  }

  return testDatabaseUrl;
}
