export interface CreditTransaction {
  amount: bigint;
  type: CreditTransactionType;
  jobId?: number;
  taskId?: number;
  details?: Record<string, unknown>;
}

export enum CreditTransactionType {
  JobFee = 'job_fee',
  JobRefund = 'job_refund',
  RenderReward = 'render_reward',
  WeeklyGrant = 'weekly_grant',
  AdminAdjustment = 'admin_adjustment',
}
