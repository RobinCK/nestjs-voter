import { VoterContext } from './voter-context.interface';

export interface IVoter<TData = any> {
  supports?(data: TData): boolean;

  vote?(context: VoterContext<any, TData, any>): Promise<boolean> | boolean;
}

export type VoterMethodFunction<TArgs = any> = (context: VoterContext<any, null, TArgs>) => Promise<boolean> | boolean;

export type VoterClass<T = any> = new (...args: any[]) => T;
