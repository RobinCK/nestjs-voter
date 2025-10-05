import { POST_AUTH_VOTER_METADATA } from '../constants/voter.constants';
import { IVoter, VoterClass } from '../models/voter.interface';
import { VoterContext } from '../models/voter-context.interface';

export interface PostAuthVoterMetadata<T extends IVoter = IVoter> {
  voterClass?: VoterClass<T>;
  methodName?: string;
  staticMethod?: (context: VoterContext<any, any, any>) => Promise<boolean> | boolean;
}

type VoterMethod<T> = T extends { [K in keyof T]: T[K] }
  ? {
      [K in keyof T]: T[K] extends (context: VoterContext<any, any, any>) => Promise<boolean> | boolean ? K : never;
    }[keyof T]
  : never;

export function PostAuthVoter<T extends IVoter>(
  voterClassOrMethod: VoterClass<T> | ((context: VoterContext<any, any, any>) => Promise<boolean> | boolean),
): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const existingMetadata =
      (Reflect.getMetadata(POST_AUTH_VOTER_METADATA, descriptor.value) as PostAuthVoterMetadata<T>[] | undefined) || [];

    const metadata: PostAuthVoterMetadata<T> =
      typeof voterClassOrMethod === 'function' && voterClassOrMethod.prototype
        ? {
            voterClass: voterClassOrMethod as VoterClass<T>,
            methodName: 'vote',
          }
        : {
            staticMethod: voterClassOrMethod as (context: VoterContext<any, any, any>) => Promise<boolean> | boolean,
          };

    Reflect.defineMetadata(POST_AUTH_VOTER_METADATA, [...existingMetadata, metadata], descriptor.value);

    return descriptor;
  };
}

export function PostAuthVoterMethod<T extends IVoter, K extends VoterMethod<T>>(
  voterClass: VoterClass<T>,
  methodName: K,
): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const existingMetadata =
      (Reflect.getMetadata(POST_AUTH_VOTER_METADATA, descriptor.value) as PostAuthVoterMetadata<T>[] | undefined) || [];

    const metadata: PostAuthVoterMetadata<T> = {
      voterClass,
      methodName: methodName as string | undefined,
    };

    Reflect.defineMetadata(POST_AUTH_VOTER_METADATA, [...existingMetadata, metadata], descriptor.value);

    return descriptor;
  };
}
