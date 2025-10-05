import { PRE_AUTH_VOTER_METADATA } from '../constants/voter.constants';
import { VoterClass, VoterMethodFunction } from '../models/voter.interface';

export interface PreAuthVoterMetadata<T = any> {
  voterClass?: VoterClass<T>;
  methodName?: string;
  staticMethod?: VoterMethodFunction;
}

type VoterMethod<T> = T extends { [K in keyof T]: T[K] }
  ? {
      [K in keyof T]: T[K] extends VoterMethodFunction ? K : never;
    }[keyof T]
  : never;

export function PreAuthVoter<T extends object>(
  voterClassOrMethod: VoterClass<T> | VoterMethodFunction,
): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const existingMetadata =
      (Reflect.getMetadata(PRE_AUTH_VOTER_METADATA, descriptor.value) as PreAuthVoterMetadata[] | undefined) || [];

    const metadata: PreAuthVoterMetadata =
      typeof voterClassOrMethod === 'function' && voterClassOrMethod.prototype
        ? {
            voterClass: voterClassOrMethod as VoterClass<T>,
            methodName: 'vote',
          }
        : {
            staticMethod: voterClassOrMethod as VoterMethodFunction,
          };

    Reflect.defineMetadata(PRE_AUTH_VOTER_METADATA, [...existingMetadata, metadata], descriptor.value);

    return descriptor;
  };
}

export function PreAuthVoterMethod<T extends object, K extends VoterMethod<T>>(
  voterClass: VoterClass<T>,
  methodName: K,
): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const existingMetadata =
      (Reflect.getMetadata(PRE_AUTH_VOTER_METADATA, descriptor.value) as PreAuthVoterMetadata<T>[] | undefined) || [];

    const metadata: PreAuthVoterMetadata<T> = {
      voterClass,
      methodName: methodName as string,
    };

    Reflect.defineMetadata(PRE_AUTH_VOTER_METADATA, [...existingMetadata, metadata], descriptor.value);

    return descriptor;
  };
}
