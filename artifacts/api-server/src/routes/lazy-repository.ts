type AsyncRepositoryMethod = (...args: unknown[]) => Promise<unknown>;

export function createLazyRepository<TRepository extends object>(
  loadRepository: () => Promise<TRepository>,
): TRepository {
  let repository: TRepository | null = null;
  let repositoryPromise: Promise<TRepository> | null = null;

  async function getRepository(): Promise<TRepository> {
    if (repository) return repository;
    repositoryPromise ??= loadRepository()
      .then((instance) => {
        repository = instance;
        return instance;
      })
      .catch((error: unknown) => {
        repositoryPromise = null;
        throw error;
      });
    return repositoryPromise;
  }

  return new Proxy({} as TRepository, {
    get(_target, property) {
      if (property === "then") return undefined;
      return async (...args: unknown[]) => {
        const instance = await getRepository();
        const value = Reflect.get(instance, property, instance);
        if (typeof value !== "function") return value;
        return (value as AsyncRepositoryMethod).apply(instance, args);
      };
    },
  });
}
