import { setTimeout } from 'node:timers/promises';
import { QueryFailedError } from 'typeorm';

// The callback must start a fresh transaction on every attempt and must not
// publish events or perform other external side effects before it commits.
export async function retryTransaction<T>(
  transaction: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await transaction();
    } catch (error) {
      const driverError =
        error instanceof QueryFailedError
          ? (error.driverError as { errno?: number; code?: string })
          : undefined;
      const retryable =
        driverError?.errno === 1213 ||
        driverError?.errno === 1020 ||
        driverError?.code === 'ER_LOCK_DEADLOCK' ||
        driverError?.code === 'ER_CHECKREAD';
      if (!retryable || attempt >= 3) throw error;
      await setTimeout(25 * 2 ** attempt + Math.floor(Math.random() * 25));
    }
  }
}
