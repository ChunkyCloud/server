import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { AccountingService } from './accounting.service';
import { GrantWorkUnitsCommand } from './commands/grantWorkUnits.command';
import { CreditTransactionLog } from './entities/creditTransactionLog.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CreditTransactionLog, User])],
  providers: [AccountingService, GrantWorkUnitsCommand],
  exports: [AccountingService],
})
export class AccountingModule {}
