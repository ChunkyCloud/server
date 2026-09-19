import { EntityManager } from 'typeorm';
import { User } from '../users/entities/user.entity';
import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreditTransaction } from './creditTransaction';
import { CreditTransactionLog } from './entities/creditTransactionLog.entity';

export type { CreditTransaction } from './creditTransaction';
export { CreditTransactionType } from './creditTransaction';

@Injectable()
export class AccountingService {
  async charge(
    transactionEntityManager: EntityManager,
    userId: number,
    transaction: CreditTransaction,
  ) {
    if (transaction.amount <= 0n) {
      throw new Error(`Charged amount must be greater than zero`);
    }
    const result = await transactionEntityManager
      .createQueryBuilder()
      .update(User)
      .set({
        credits: () => 'credits - :cost',
      })
      .where('id = :userId', { userId })
      .andWhere('credits >= :cost')
      .setParameters({ cost: transaction.amount })
      .execute();
    if (result.affected !== 1) {
      throw new HttpException(
        `Insufficient credits (tried to charge ${transaction.amount})`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    await transactionEntityManager.save(CreditTransactionLog, {
      ...transaction,
      userId,
      amount: -transaction.amount,
    });
  }

  async reward(
    transactionEntityManager: EntityManager,
    userId: number,
    transaction: CreditTransaction,
  ) {
    if (transaction.amount <= 0n) {
      throw new Error(`Rewarded amount must be greater than zero`);
    }
    const result = await transactionEntityManager
      .createQueryBuilder()
      .update(User)
      .set({
        credits: () => 'credits + :amount',
      })
      .where('id = :userId', { userId })
      .setParameters({ amount: transaction.amount })
      .execute();
    if (result.affected !== 1) {
      throw new NotFoundException('User not found');
    }
    await transactionEntityManager.save(CreditTransactionLog, {
      ...transaction,
      userId,
    });
  }
}
