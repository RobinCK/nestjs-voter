import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { PRE_AUTH_VOTER_METADATA, POST_AUTH_VOTER_METADATA } from '../constants/voter.constants';
import { VoterException } from '../exceptions/voter.exception';
import { IVoter, VoterClass } from '../models/voter.interface';
import { VoterContext } from '../models/voter-context.interface';
import { PreAuthVoterMetadata } from '../decorators/pre-auth-voter.decorator';
import { PostAuthVoterMetadata } from '../decorators/post-auth-voter.decorator';
import { OperationType } from '../models/operation-type.enum';

interface RequestWithUser {
  user?: any;
  params?: Record<string, any>;
  query?: Record<string, any>;
  body?: Record<string, any>;
}

@Injectable()
export class VoterInterceptor implements NestInterceptor {
  private readonly logger = new Logger(VoterInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
  ) {}

  private getGqlExecutionContext(): any {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { GqlExecutionContext } = require('@nestjs/graphql');
      return GqlExecutionContext;
    } catch (error) {
      throw new Error(
        'GraphQL context detected but @nestjs/graphql is not installed. ' +
        'Please install it with: npm install @nestjs/graphql'
      );
    }
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const preAuthMetadata = this.reflector.get<PreAuthVoterMetadata[]>(PRE_AUTH_VOTER_METADATA, context.getHandler());
    const postAuthMetadata = this.reflector.get<PostAuthVoterMetadata[]>(
      POST_AUTH_VOTER_METADATA,
      context.getHandler(),
    );

    if (!preAuthMetadata && !postAuthMetadata) {
      return next.handle();
    }

    const req = this.getRequest(context);
    const args = this.getMethodArguments(context);
    const { methodName, operationType } = this.getMethodContext(context);

    const voterContext: VoterContext = {
      data: null,
      args,
      auth: req.user, // eslint-disable-line @typescript-eslint/no-unsafe-assignment
      context,
      methodName,
      operationType,
    };

    if (preAuthMetadata) {
      await this.executePreAuthVoters(preAuthMetadata, voterContext);
    }

    if (postAuthMetadata) {
      return next.handle().pipe(
        mergeMap(async (data: unknown) => {
          voterContext.data = data;
          await this.executePostAuthVoters(postAuthMetadata, voterContext);
          return data;
        }),
      );
    }

    return next.handle();
  }

  private async executePreAuthVoters(metadata: PreAuthVoterMetadata[], context: VoterContext): Promise<void> {
    for (const meta of metadata) {
      if (meta.staticMethod) {
        const hasAccess = await meta.staticMethod(context);

        if (!hasAccess) {
          throw new VoterException('Pre-authorization access denied');
        }
      } else if (meta.voterClass) {
        const voter = await this.getVoterInstance(meta.voterClass);
        const methodName = meta.methodName || 'vote';

        if (!(methodName in voter)) {
          throw new Error(`Method ${methodName} not found in ${meta.voterClass.name}`);
        }

        const method = voter[methodName as keyof IVoter];

        if (typeof method !== 'function') {
          throw new TypeError(`${methodName} is not a function in ${meta.voterClass.name}`);
        }

        const hasAccess = await (method as (context: VoterContext) => Promise<boolean>).call(voter, context);

        if (!hasAccess) {
          throw new VoterException(`Pre-authorization denied by ${meta.voterClass.name}.${methodName}`);
        }
      }
    }
  }

  private async executePostAuthVoters(metadata: PostAuthVoterMetadata[], context: VoterContext): Promise<void> {
    for (const meta of metadata) {
      if (meta.staticMethod) {
        const hasAccess = await meta.staticMethod(context);

        if (!hasAccess) {
          throw new VoterException('Post-authorization access denied');
        }
      } else if (meta.voterClass) {
        const voter = await this.getVoterInstance(meta.voterClass);

        if (voter.supports && !voter.supports(context.data)) {
          continue;
        }

        const methodName = meta.methodName || 'vote';

        if (!(methodName in voter)) {
          throw new Error(`Method ${methodName} not found in ${meta.voterClass.name}`);
        }

        const method = voter[methodName as keyof IVoter];

        if (typeof method !== 'function') {
          throw new TypeError(`${methodName} is not a function in ${meta.voterClass.name}`);
        }

        const hasAccess = await (method as (context: VoterContext) => Promise<boolean>).call(voter, context);

        if (!hasAccess) {
          throw new VoterException(`Post-authorization denied by ${meta.voterClass.name}.${methodName}`);
        }
      }
    }
  }

  private async getVoterInstance<T>(voterClass: VoterClass<T>): Promise<T> {
    try {
      return this.moduleRef.get(voterClass, { strict: false });
    } catch {
      return new voterClass();
    }
  }

  private getRequest(context: ExecutionContext): RequestWithUser {
    const contextType = context.getType<'http' | 'graphql'>();

    if (contextType === OperationType.HTTP) {
      return context.switchToHttp().getRequest<RequestWithUser>();
    }

    const GqlExecutionContext = this.getGqlExecutionContext();
    const gqlContext = GqlExecutionContext.create(context).getContext();
    return gqlContext.req as RequestWithUser;
  }

  private getMethodArguments(context: ExecutionContext): Record<string, any> {
    const contextType = context.getType<'http' | 'graphql'>();

    if (contextType === 'http') {
      const request = context.switchToHttp().getRequest<RequestWithUser>();
      return {
        ...request.params,
        ...request.query,
        ...request.body,
      };
    }

    const GqlExecutionContext = this.getGqlExecutionContext();
    return GqlExecutionContext.create(context).getArgs();
  }

  private getMethodContext(context: ExecutionContext): {
    methodName: string;
    operationType: OperationType;
  } {
    const contextType = context.getType<OperationType>();

    if (contextType === OperationType.HTTP) {
      return {
        methodName: context.getHandler().name,
        operationType: OperationType.HTTP,
      };
    }

    const GqlExecutionContext = this.getGqlExecutionContext();
    const gqlContext = GqlExecutionContext.create(context);
    const info = (gqlContext.getInfo as any)() as {
      fieldName: string;
      operation: { operation: string };
    };

    const operationType = info.operation.operation as OperationType;

    if (
      operationType !== OperationType.QUERY &&
      operationType !== OperationType.MUTATION &&
      operationType !== OperationType.SUBSCRIPTION
    ) {
      throw new Error(`Unknown GraphQL operation type: ${operationType}`);
    }

    return {
      methodName: info.fieldName,
      operationType: operationType,
    };
  }
}
