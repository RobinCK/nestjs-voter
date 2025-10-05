import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector, ModuleRef } from '@nestjs/core';
import { of } from 'rxjs';
import { VoterInterceptor } from '../interceptors/voter.interceptor';
import { VoterException } from '../exceptions/voter.exception';
import { PRE_AUTH_VOTER_METADATA, POST_AUTH_VOTER_METADATA } from '../constants/voter.constants';
import { BaseVoter } from '../base/base-voter';
import {VoterContext} from "../models/voter-context.interface";

class TestVoter extends BaseVoter {
  async vote(context: VoterContext<any, any, any>): Promise<boolean> {
    return context.data?.allowAccess === true;
  }

  async canCreate(context: VoterContext<any, any, any>): Promise<boolean> {
    return context.auth?.role === 'admin';
  }

  async canUpdate(context: VoterContext<any, any, any>): Promise<boolean> {
    return context.auth?.id === context.args?.userId;
  }
}

describe('VoterInterceptor', () => {
  let interceptor: VoterInterceptor;
  let reflector: Reflector;
  let moduleRef: ModuleRef;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoterInterceptor,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: ModuleRef,
          useValue: {
            get: jest.fn().mockImplementation(() => new TestVoter()),
          },
        },
      ],
    }).compile();

    interceptor = module.get<VoterInterceptor>(VoterInterceptor);
    reflector = module.get<Reflector>(Reflector);
    moduleRef = module.get<ModuleRef>(ModuleRef);
  });

  const createMockContext = (
    type: 'http' | 'graphql' = 'http',
    user = { id: 'user1', role: 'user' }
  ): ExecutionContext => {
    const request = {
      user,
      params: {},
      query: {},
      body: {},
    };

    return {
      getType: jest.fn().mockReturnValue(type),
      getHandler: jest.fn().mockReturnValue(() => {}),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
      getClass: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
    } as unknown as ExecutionContext;
  };

  const createMockCallHandler = (data: any = { allowAccess: true }): CallHandler => ({
    handle: jest.fn().mockReturnValue(of(data)),
  });

  describe('Pre-authorization', () => {
    it('should pass when no metadata is present', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const context = createMockContext();
      const next = createMockCallHandler();
      const result = await interceptor.intercept(context, next);

      expect(result).toBe(next.handle());
    });

    it('should pass pre-authorization with voter class', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key: unknown) => {
        if (key === PRE_AUTH_VOTER_METADATA) {
          return [{ voterClass: TestVoter, methodName: 'canCreate' }];
        }
        return undefined;
      });

      const context = createMockContext('http', { id: 'user1', role: 'admin' });
      const next = createMockCallHandler();

      const result = await interceptor.intercept(context, next);

      expect(next.handle).toHaveBeenCalled();
    });

    it('should deny pre-authorization when voter returns false', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key: unknown) => {
        if (key === PRE_AUTH_VOTER_METADATA) {
          return [{ voterClass: TestVoter, methodName: 'canCreate' }];
        }

        return undefined;
      });

      const context = createMockContext('http', { id: 'user1', role: 'user' });
      const next = createMockCallHandler();

      await expect(
        interceptor.intercept(context, next)
      ).rejects.toThrow(VoterException);
    });

    it('should pass pre-authorization with static method', async () => {
      const staticMethod = jest.fn().mockResolvedValue(true);

      jest.spyOn(reflector, 'get').mockImplementation((key: unknown) => {
        if (key === PRE_AUTH_VOTER_METADATA) {
          return [{ staticMethod }];
        }

        return undefined;
      });

      const context = createMockContext();
      const next = createMockCallHandler();

      await interceptor.intercept(context, next);

      expect(staticMethod).toHaveBeenCalled();
      expect(next.handle).toHaveBeenCalled();
    });

    it('should deny with static method returning false', async () => {
      const staticMethod = jest.fn().mockResolvedValue(false);

      jest.spyOn(reflector, 'get').mockImplementation((key: unknown) => {
        if (key === PRE_AUTH_VOTER_METADATA) {
          return [{ staticMethod }];
        }

        return undefined;
      });

      const context = createMockContext();
      const next = createMockCallHandler();

      await expect(
        interceptor.intercept(context, next)
      ).rejects.toThrow(VoterException);
    });

    it('should execute multiple pre-authorization voters', async () => {
      const staticMethod1 = jest.fn().mockResolvedValue(true);
      const staticMethod2 = jest.fn().mockResolvedValue(true);

      jest.spyOn(reflector, 'get').mockImplementation((key: unknown) => {
        if (key === PRE_AUTH_VOTER_METADATA) {
          return [
            { staticMethod: staticMethod1 },
            { staticMethod: staticMethod2 },
          ];
        }
        return undefined;
      });

      const context = createMockContext();
      const next = createMockCallHandler();

      await interceptor.intercept(context, next);

      expect(staticMethod1).toHaveBeenCalled();
      expect(staticMethod2).toHaveBeenCalled();
      expect(next.handle).toHaveBeenCalled();
    });

    it('should fail if any pre-authorization voter denies', async () => {
      const staticMethod1 = jest.fn().mockResolvedValue(true);
      const staticMethod2 = jest.fn().mockResolvedValue(false);

      jest.spyOn(reflector, 'get').mockImplementation((key: unknown) => {
        if (key === PRE_AUTH_VOTER_METADATA) {
          return [
            { staticMethod: staticMethod1 },
            { staticMethod: staticMethod2 },
          ];
        }

        return undefined;
      });

      const context = createMockContext();
      const next = createMockCallHandler();

      await expect(
        interceptor.intercept(context, next)
      ).rejects.toThrow(VoterException);

      expect(staticMethod1).toHaveBeenCalled();
      expect(staticMethod2).toHaveBeenCalled();
    });
  });

  describe('Post-authorization', () => {
    it('should pass post-authorization with voter class', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key: unknown) => {
        if (key === POST_AUTH_VOTER_METADATA) {
          return [{ voterClass: TestVoter, methodName: 'vote' }];
        }
        return undefined;
      });

      const context = createMockContext();
      const next = createMockCallHandler({ allowAccess: true });
      const result$ = await interceptor.intercept(context, next);

      await new Promise<void>((resolve) => {
        result$.subscribe({
          next: (data) => {
            expect(data).toEqual({ allowAccess: true });
            resolve();
          },
        });
      });
    });

    it('should deny post-authorization when voter returns false', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key: unknown) => {
        if (key === POST_AUTH_VOTER_METADATA) {
          return [{ voterClass: TestVoter, methodName: 'vote' }];
        }

        return undefined;
      });

      const context = createMockContext();
      const next = createMockCallHandler({ allowAccess: false });
      const result$ = await interceptor.intercept(context, next);

      await expect(
        new Promise((resolve, reject) => {
          result$.subscribe({
            error: (err) => reject(err),
          });
        })
      ).rejects.toThrow(VoterException);
    });

    it('should pass post-authorization with static method', async () => {
      const staticMethod = jest.fn().mockResolvedValue(true);

      jest.spyOn(reflector, 'get').mockImplementation((key: unknown) => {
        if (key === POST_AUTH_VOTER_METADATA) {
          return [{ staticMethod }];
        }

        return undefined;
      });

      const context = createMockContext();
      const next = createMockCallHandler({ data: 'test' });
      const result$ = await interceptor.intercept(context, next);

      await new Promise<void>((resolve) => {
        result$.subscribe({
          next: () => {
            expect(staticMethod).toHaveBeenCalledWith(
              expect.objectContaining({ data: { data: 'test' } })
            );
            resolve();
          },
        });
      });
    });

    it('should skip voter when supports returns false', async () => {
      class CustomVoter extends BaseVoter {
        supports(): boolean {
          return false;
        }

        async vote(): Promise<boolean> {
          throw new Error('Should not be called');
        }
      }

      jest.spyOn(moduleRef, 'get').mockImplementation(() => new CustomVoter());

      jest.spyOn(reflector, 'get').mockImplementation((key: unknown) => {
        if (key === POST_AUTH_VOTER_METADATA) {
          return [{ voterClass: CustomVoter, methodName: 'vote' }];
        }

        return undefined;
      });

      const context = createMockContext();
      const next = createMockCallHandler({ data: 'test' });
      const result$ = await interceptor.intercept(context, next);

      await new Promise<void>((resolve) => {
        result$.subscribe({
          next: (data) => {
            expect(data).toEqual({ data: 'test' });
            resolve();
          },
        });
      });
    });
  });

  describe('Combined authorization', () => {
    it('should execute both pre and post authorization', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key: unknown) => {
        if (key === PRE_AUTH_VOTER_METADATA) {
          return [{ voterClass: TestVoter, methodName: 'canCreate' }];
        }

        if (key === POST_AUTH_VOTER_METADATA) {
          return [{ voterClass: TestVoter, methodName: 'vote' }];
        }

        return undefined;
      });

      const context = createMockContext('http', { id: 'user1', role: 'admin' });
      const next = createMockCallHandler({ allowAccess: true });
      const result$ = await interceptor.intercept(context, next);

      await new Promise<void>((resolve) => {
        result$.subscribe({
          next: (data) => {
            expect(data).toEqual({ allowAccess: true });
            resolve();
          },
        });
      });
    });

    it('should fail if pre-authorization denies', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key: unknown) => {
        if (key === PRE_AUTH_VOTER_METADATA) {
          return [{ voterClass: TestVoter, methodName: 'canCreate' }];
        }

        if (key === POST_AUTH_VOTER_METADATA) {
          return [{ voterClass: TestVoter, methodName: 'vote' }];
        }

        return undefined;
      });

      const context = createMockContext('http', { id: 'user1', role: 'user' });
      const next = createMockCallHandler({ allowAccess: true });

      await expect(
        interceptor.intercept(context, next)
      ).rejects.toThrow(VoterException);

      expect(next.handle).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should throw error when method not found in voter', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key: unknown) => {
        if (key === PRE_AUTH_VOTER_METADATA) {
          return [{ voterClass: TestVoter, methodName: 'nonExistentMethod' }];
        }

        return undefined;
      });

      const context = createMockContext();
      const next = createMockCallHandler();

      await expect(
        interceptor.intercept(context, next)
      ).rejects.toThrow('Method nonExistentMethod not found');
    });
  });
});
