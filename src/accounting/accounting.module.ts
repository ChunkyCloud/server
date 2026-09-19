import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingService } from './accounting.service';
import { CreditTransactionLog } from './entities/creditTransactionLog.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CreditTransactionLog])],
  providers: [AccountingService],
  exports: [AccountingService],
})
export class AccountingModule {}
