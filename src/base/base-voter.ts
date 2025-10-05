import { IVoter } from '../models/voter.interface';
import { VoterContext } from '../models/voter-context.interface';

export abstract class BaseVoter<TData = any> implements IVoter<TData> {
  supports(data: TData): boolean {
    return true;
  }

  abstract vote(context: VoterContext<any, TData, any>): Promise<boolean>
}
