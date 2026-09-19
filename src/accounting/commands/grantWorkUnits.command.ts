import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Command, CommandRunner } from 'nest-commander';
import { DataSource, Repository } from 'typeorm';
import {
  AccountingService,
  CreditTransactionType,
} from '../accounting.service';
import { User } from '../../users/entities/user.entity';

@Command({
  name: 'grant-work-units',
  aliases: ['give'],
  arguments: '<user-id> <work-units> <note>',
  description:
    'Credit work units to a user and record the note in the ledger (1 work unit = 1 credit)',
})
export class GrantWorkUnitsCommand extends CommandRunner {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly accounting: AccountingService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    super();
  }

  async run([userId, amount, note]: string[]) {
    if (
      !/^[1-9][0-9]*$/.test(userId ?? '') ||
      !Number.isSafeInteger(Number(userId))
    ) {
      throw new Error('User ID must be a positive safe integer');
    }
    if (!/^[1-9][0-9]*$/.test(amount ?? '')) {
      throw new Error('Work units must be a positive integer');
    }
    const user = await this.users.findOneOrFail({
      where: { id: parseInt(userId, 10) },
    });
    await this.dataSource.transaction(async (manager) => {
      await this.accounting.reward(manager, Number(userId), {
        amount: BigInt(amount),
        type: CreditTransactionType.AdminAdjustment,
        note: note.trim(),
      });
    });
    console.log(`Granted ${amount} work units to ${user.displayName}.`);
  }
}
