import { ExecutionContext } from '@nestjs/common';
import { OperationType } from './operation-type.enum';

export interface VoterContext<TUser = any, TData = any, TArgs = any> {
  data: TData;
  args: TArgs;
  auth: TUser;
  context: ExecutionContext;
  methodName: string;
  operationType: OperationType;
}
