import assert from "node:assert/strict";
import test from "node:test";

import { createLazyRepository } from "./lazy-repository";

interface TestRepository {
  ping(): Promise<string>;
}

test("createLazyRepository shares one in-flight repository load", async () => {
  let loadCount = 0;
  let releaseLoad!: (repository: TestRepository) => void;
  const loadPromise = new Promise<TestRepository>((resolve) => {
    releaseLoad = resolve;
  });

  const repository = createLazyRepository(async () => {
    loadCount += 1;
    return await loadPromise;
  });

  const first = repository.ping();
  const second = repository.ping();

  assert.equal(loadCount, 1);
  releaseLoad({
    async ping() {
      return "ok";
    },
  });

  assert.deepEqual(await Promise.all([first, second]), ["ok", "ok"]);
  assert.equal(loadCount, 1);
});

test("createLazyRepository retries after a failed load", async () => {
  let loadCount = 0;
  const repository = createLazyRepository(async () => {
    loadCount += 1;
    if (loadCount === 1) {
      throw new Error("temporary load failure");
    }
    return {
      async ping() {
        return "ready";
      },
    };
  });

  await assert.rejects(repository.ping(), /temporary load failure/);
  assert.equal(await repository.ping(), "ready");
  assert.equal(loadCount, 2);
});
