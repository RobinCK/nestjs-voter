# NestJS Voter

A sophisticated, type-safe authorization module for NestJS that provides fine-grained access control through the Voter pattern. This module enables you to implement complex authorization logic that can evaluate both before method execution (pre-authorization) and after data retrieval (post-authorization), with full TypeScript support and autocompletion.

Unlike traditional Guards that only provide binary yes/no decisions at the route level, Voters offer:
- Data-aware authorization decisions (inspect returned data)
- Composable authorization logic (multiple voters per endpoint)
- Reusable authorization rules across different contexts
- Type-safe method references with IDE autocompletion
- Support for both class-based and functional authorization logic

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Decorators](#decorators)
- [Usage Examples](#usage-examples)
- [Voters vs Guards](#voters-vs-guards)
- [Advanced Patterns](#advanced-patterns)
- [Testing](#testing)
- [API Reference](#api-reference)

## Installation

```bash
npm install nestjs-voter
```

## Quick Start

### 1. Import the module

```typescript
import { Module } from '@nestjs/common';
import { VoterModule } from 'nestjs-voter';

@Module({
  imports: [VoterModule],
})
export class AppModule {}
```

### 2. Create a voter

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { BaseVoter, VoterContext } from 'nestjs-voter';

interface User {
  id: string;
  role: string;
}

@Injectable()
export class UserVoter extends BaseVoter<User> {
  private readonly logger = new Logger(UserVoter.name);

  supports(data: any): boolean {
    return data && typeof data === 'object' && 'id' in data;
  }

  async vote(context: VoterContext<any, User, any>): Promise<boolean> {
    const { data, auth } = context;
    return data.id === auth.user.id || auth.user.role === 'admin';
  }

  async canCreate(context: VoterContext<any, null, any>): Promise<boolean> {
    return context.auth.user.role === 'admin';
  }
}
```

### 3. Apply decorators

```typescript
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { PreAuthVoterMethod, PostAuthVoter } from 'nestjs-voter';
import { UserVoter } from './user.voter';

@Resolver('User')
export class UserResolver {
  @Query()
  @PostAuthVoter(UserVoter)
  async user(@Args('id') id: string) {
    return this.userService.findById(id);
  }

  @Mutation()
  @PreAuthVoterMethod(UserVoter, 'canCreate')
  @PostAuthVoter(UserVoter)
  async createUser(@Args('input') input: CreateUserInput) {
    return this.userService.create(input);
  }
}
```

## Core Concepts

### Pre-Authorization vs Post-Authorization

**Pre-Authorization** executes before the handler method runs. Use it when:
- You need to validate permissions before any database queries
- The authorization decision doesn't depend on the returned data
- You want to fail fast without executing expensive operations

**Post-Authorization** executes after the handler method returns data. Use it when:
- Authorization depends on the actual data being accessed
- You need to filter or validate returned entities
- The decision requires inspecting the resource properties

### Voter Context

Every voter method receives a `VoterContext` object containing:

```typescript
interface VoterContext<TUser = any, TData = any, TArgs = any> {
  data: TData;                 // Returned data (null in pre-authorization)
  args: TArgs;                 // Method arguments
  auth: TUser;                 // Authenticated user from request
  context: ExecutionContext;   // NestJS execution context
  methodName: string;          // Handler method name
  operationType: OperationType //'query' | 'mutation' | 'subscription' | 'http';
}
```

### Supports Method

The `supports` method determines if a voter can handle specific data:

```typescript
supports(data: any): boolean {
  return data instanceof UserDto;
}
```

This is only checked for post-authorization. If `supports` returns `false`, the voter is skipped.

## Decorators

### @PreAuthVoter

Execute authorization before the handler method.

**With voter class (calls `vote` method):**
```typescript
@PreAuthVoter(UserVoter)
async someMethod() {}
```

**With inline function:**
```typescript
@PreAuthVoter((context: VoterContext<any, null, any>) => {
  return context.auth.user.role === 'admin';
})
async someMethod() {}
```

### @PreAuthVoterMethod

Execute a specific voter method for pre-authorization:

```typescript
@PreAuthVoterMethod(UserVoter, 'canCreate')
async createUser() {}
```

TypeScript validates that the method exists and provides autocompletion.

### @PostAuthVoter

Execute authorization after the handler returns data.

**With voter class (calls `vote` method):**
```typescript
@PostAuthVoter(UserVoter)
async getUser() {}
```

**With inline function:**
```typescript
@PostAuthVoter((context: VoterContext<any, User, any>) => {
  return context.data.id === context.auth.user.id;
})
async getUser() {}
```

### @PostAuthVoterMethod

Execute a specific voter method for post-authorization:

```typescript
@PostAuthVoterMethod(UserVoter, 'customCheck')
async getUser() {}
```

## Usage Examples

### GraphQL Resolver

```typescript
import { Resolver, Query, Mutation, Subscription, Args } from '@nestjs/graphql';
import { 
  PreAuthVoter, 
  PreAuthVoterMethod, 
  PostAuthVoter 
} from 'nestjs-voter';
import { UserVoter } from './user.voter';

@Resolver('User')
export class UserResolver {
  constructor(private userService: UserService) {}

  @Query()
  @PostAuthVoter(UserVoter)
  async user(@Args('id') id: string) {
    return this.userService.findById(id);
  }

  @Query()
  @PostAuthVoter((context: VoterContext<any, any, any>) => {
    return context.data.every(user => 
      user.isPublic || user.id === context.auth.user.id
    );
  })
  async users() {
    return this.userService.findAll();
  }

  @Mutation()
  @PreAuthVoterMethod(UserVoter, 'canCreate')
  @PostAuthVoter(UserVoter)
  async createUser(@Args('input') input: CreateUserInput) {
    return this.userService.create(input);
  }

  @Mutation()
  @PreAuthVoter((context: VoterContext<any, null, any>) => {
    return context.args.input.id === context.auth.user.id;
  })
  async updateUser(@Args('input') input: UpdateUserInput) {
    return this.userService.update(input);
  }

  @Subscription()
  @PostAuthVoter((context: VoterContext<any, any, any>) => {
    return context.data.userId === context.auth.user.id;
  })
  userUpdated() {
    return this.userService.subscribeToUpdates();
  }
}
```

### REST Controller

```typescript
import { Controller, Get, Post, Put, Param, Body } from '@nestjs/common';
import { PreAuthVoterMethod, PostAuthVoter } from 'nestjs-voter';
import { UserVoter } from './user.voter';

@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get(':id')
  @PostAuthVoter(UserVoter)
  async getUser(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Post()
  @PreAuthVoterMethod(UserVoter, 'canCreate')
  @PostAuthVoter(UserVoter)
  async createUser(@Body() body: CreateUserDto) {
    return this.userService.create(body);
  }

  @Put(':id')
  @PreAuthVoter((context: VoterContext<any, null, any>) => {
    return context.args.id === context.auth.user.id;
  })
  @PostAuthVoter(UserVoter)
  async updateUser(
    @Param('id') id: string,
    @Body() body: UpdateUserDto
  ) {
    return this.userService.update(id, body);
  }
}
```

### Complex Voter with Dependencies

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { BaseVoter, VoterContext } from 'nestjs-voter';

interface PostDto {
  id: string;
  authorId: string;
  title: string;
}

interface PaginationDto<T> {
  records: T[];
  total: number;
}

type PostVoterData = PostDto | PostDto[] | PaginationDto<PostDto>;

@Injectable()
export class PostVoter extends BaseVoter<PostVoterData> {
  private readonly logger = new Logger(PostVoter.name);

  constructor(
    private readonly postService: PostService,
    private readonly userService: UserService
  ) {
    super();
  }

  supports(data: any): boolean {
    if (Array.isArray(data)) {
      return data.length > 0 && this.isPostDto(data[0]);
    }
    
    if (this.isPaginationDto(data)) {
      return data.records.length > 0 && this.isPostDto(data.records[0]);
    }
    
    return this.isPostDto(data);
  }

  async vote(context: VoterContext<any, PostVoterData, any>): Promise<boolean> {
    const { data, auth } = context;

    if (Array.isArray(data)) {
      return data.every(item => this.checkAccess(item, auth));
    }

    if (this.isPaginationDto(data)) {
      return data.records.every(item => this.checkAccess(item, auth));
    }

    return this.checkAccess(data as PostDto, auth);
  }

  async canUpdate(context: VoterContext<any, null, UpdatePostArgs>): Promise<boolean> {
    const { args, auth } = context;
    const post = await this.postService.findById(args.id);
    
    if (!post) {
      this.logger.debug(`Post ${args.id} not found`);
      return false;
    }

    return post.authorId === auth.user.id || auth.user.role === 'admin';
  }

  private checkAccess(post: PostDto, auth: any): boolean {
    return post.authorId === auth.user.id || auth.user.role === 'admin';
  }

  private isPostDto(obj: any): obj is PostDto {
    return obj && typeof obj === 'object' && 'id' in obj && 'authorId' in obj;
  }

  private isPaginationDto(obj: any): obj is PaginationDto<any> {
    return obj && 'records' in obj && Array.isArray(obj.records);
  }
}
```

## Voters vs Guards

### When to Use Voters

**Advantages:**
- **Data-aware decisions**: Can inspect returned data to make authorization choices
- **Composable**: Multiple voters can be applied to a single endpoint
- **Reusable**: Same voter logic across different contexts
- **Type-safe**: Full TypeScript support with method validation
- **Flexible**: Support both class-based and functional approaches
- **Context-rich**: Access to method arguments, user, and execution context

**Use voters when:**
- Authorization depends on the actual data being accessed
- You need to apply multiple authorization rules
- Logic varies based on the returned data structure
- You want reusable authorization components

### When to Use Guards

**Advantages:**
- **Simple**: Straightforward boolean decision at route level
- **Fast**: Executes before any handler logic
- **Standard**: Built-in NestJS pattern
- **Route-level**: Clear separation from business logic

**Use guards when:**
- Simple role-based authorization (e.g., admin-only routes)
- Decision doesn't depend on returned data
- You need the fastest possible check
- Route-level protection is sufficient

### Combining Both

You can use both guards and voters together:

```typescript
@Controller('posts')
@UseGuards(AuthGuard)  // Ensure user is authenticated
export class PostController {
  @Get(':id')
  @PostAuthVoter(PostVoter)  // Check if user can access this specific post
  async getPost(@Param('id') id: string) {
    return this.postService.findById(id);
  }
}
```

### Comparison Table

| Feature | Guards | Voters |
|---------|--------|--------|
| Execution timing | Before handler | Before or after handler |
| Data access | No | Yes (post-auth) |
| Multiple per endpoint | Yes, but all must pass | Yes, all must pass |
| TypeScript support | Basic | Full with autocompletion |
| Reusability | Limited | High |
| Complexity | Simple | Flexible |
| Performance | Fastest | Slightly slower (post-auth) |

## Advanced Patterns

### Multiple Voters

Apply multiple voters to a single endpoint. All must return `true`:

```typescript
@Mutation()
@PreAuthVoterMethod(UserVoter, 'canCreate')
@PreAuthVoterMethod(SubscriptionVoter, 'hasActiveSubscription')
@PostAuthVoter(UserVoter)
async createUser(@Args('input') input: CreateUserInput) {
  return this.userService.create(input);
}
```

### Typed Arguments

Ensure type safety for your voter methods:

```typescript
interface UpdatePostArgs {
  id: string;
  title?: string;
  content?: string;
}

@Injectable()
export class PostVoter extends BaseVoter {
  async canUpdate(
    context: VoterContext<null, UpdatePostArgs>
  ): Promise<boolean> {
    const postId = context.args.id;
    const newTitle = context.args.title;
    // TypeScript knows the structure of args
  }
}
```

### Handling Different Data Types

Handle various return types in a single voter:

```typescript
@Injectable()
export class PostVoter extends BaseVoter<Post | Post[] | PaginationDto<Post>> {
  supports(data: any): boolean {
    if (Array.isArray(data)) {
      return data[0] instanceof Post;
    }
    if (data.records) {
      return data.records[0] instanceof Post;
    }
    return data instanceof Post;
  }

  async vote(context: VoterContext): Promise<boolean> {
    const { data, auth } = context;

    if (Array.isArray(data)) {
      return data.every(post => this.check(post, auth));
    }

    if (data.records) {
      return data.records.every(post => this.check(post, auth));
    }

    return this.check(data, auth);
  }

  private check(post: Post, auth: any): boolean {
    return post.authorId === auth.user.id;
  }
}
```

### Voter Without @Injectable

Simple voters don't need dependency injection:

```typescript
export class SimpleVoter extends BaseVoter {
  async vote(context: VoterContext): Promise<boolean> {
    return context.auth.user.role === 'admin';
  }
}
```

The interceptor will instantiate it automatically.

### Inline Voters for Quick Checks

For one-off authorization logic:

```typescript
@Mutation()
@PreAuthVoter((context: VoterContext<any, null, any>) => {
  return context.args.input.userId === context.auth.user.id;
})
@PostAuthVoter((context: VoterContext<any, any, any>) => {
  return context.data.isPublished || context.data.authorId === context.auth.user.id;
})
async updatePost(@Args('input') input: UpdatePostInput) {
  return this.postService.update(input);
}
```

### GraphQL Subscriptions

Voters work seamlessly with GraphQL subscriptions:

```typescript
@Subscription()
@PostAuthVoter((context: VoterContext<any, any, any>) => {
  return context.data.userId === context.auth.user.id;
})
postUpdated(@Args('userId') userId: string) {
  return this.postService.subscribeToUpdates(userId);
}
```

Note: For subscriptions, the voter checks each emitted value. Ensure your authorization logic is efficient to avoid performance issues.

### Complex Authorization Logic

Combine multiple conditions:

```typescript
async canEdit(context: VoterContext<any, null, EditPostArgs>): Promise<boolean> {
  const { args, auth } = context;
  const post = await this.postService.findById(args.id);
  
  const isAuthor = post.authorId === auth.user.id;
  const isAdmin = auth.user.role === 'admin';
  const isNotLocked = !post.isLocked;
  const isWithinEditWindow = this.isWithinEditTime(post.createdAt);
  
  return (isAuthor && isNotLocked && isWithinEditWindow) || isAdmin;
}

private isWithinEditTime(createdAt: Date): boolean {
  const now = new Date();
  const hours = (now.getTime() - createdAt.getTime()) / 1000 / 60 / 60;
  return hours < 24;
}
```

## Testing

### Unit Tests

```typescript
import { Test } from '@nestjs/testing';
import { PostVoter } from './post.voter';
import { PostService } from './post.service';
import { VoterContext } from 'nestjs-voter';

describe('PostVoter', () => {
  let voter: PostVoter;
  let postService: PostService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PostVoter,
        {
          provide: PostService,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    voter = module.get<PostVoter>(PostVoter);
    postService = module.get<PostService>(PostService);
  });

  describe('canUpdate', () => {
    it('should allow author to update their post', async () => {
      const context: VoterContext<any, null, UpdatePostArgs> = {
        data: null,
        args: { id: '1', title: 'New Title' },
        auth: { user: { id: 'user1', role: 'user' } },
        context: {} as any,
        methodName: 'updatePost',
        operationType: 'mutation',
      };

      jest.spyOn(postService, 'findById').mockResolvedValue({
        id: '1',
        authorId: 'user1',
      } as any);

      const result = await voter.canUpdate(context);
      expect(result).toBe(true);
    });

    it('should deny non-author from updating post', async () => {
      const context: VoterContext<any, null, UpdatePostArgs> = {
        data: null,
        args: { id: '1', title: 'New Title' },
        auth: { user: { id: 'user2', role: 'user' } },
        context: {} as any,
        methodName: 'updatePost',
        operationType: 'mutation',
      };

      jest.spyOn(postService, 'findById').mockResolvedValue({
        id: '1',
        authorId: 'user1',
      } as any);

      const result = await voter.canUpdate(context);
      expect(result).toBe(false);
    });

    it('should allow admin to update any post', async () => {
      const context: VoterContext<any, null, UpdatePostArgs> = {
        data: null,
        args: { id: '1', title: 'New Title' },
        auth: { user: { id: 'user2', role: 'admin' } },
        context: {} as any,
        methodName: 'updatePost',
        operationType: 'mutation',
      };

      jest.spyOn(postService, 'findById').mockResolvedValue({
        id: '1',
        authorId: 'user1',
      } as any);

      const result = await voter.canUpdate(context);
      expect(result).toBe(true);
    });
  });

  describe('vote', () => {
    it('should allow access to own post', async () => {
      const post = { id: '1', authorId: 'user1', title: 'Post' };
      const context: VoterContext<any, any, any> = {
        data: post,
        args: {},
        auth: { user: { id: 'user1', role: 'user' } },
        context: {} as any,
        methodName: 'getPost',
        operationType: 'query',
      };

      const result = await voter.vote(context);
      expect(result).toBe(true);
    });
  });
});
```

### Integration Tests

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './app.module';

describe('PostResolver (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('should deny access without authentication', () => {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query {
            post(id: "1") {
              id
              title
            }
          }
        `,
      })
      .expect(403);
  });

  it('should allow author to access their post', async () => {
    const token = await getAuthToken('user1');
    
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `
          query {
            post(id: "1") {
              id
              title
            }
          }
        `,
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.post).toBeDefined();
      });
  });
});
```

## API Reference

### BaseVoter

```typescript
abstract class BaseVoter<TData = any> implements IVoter<TData> {
  supports(data: TData): boolean;
  vote(context: VoterContext<any, TData, any>): Promise<boolean>;
}
```

### VoterContext

```typescript
interface VoterContext<TUser = any, TData = any, TArgs = any> {
  data: TData;
  args: TArgs;
  auth: any;
  context: ExecutionContext;
  methodName: string;
  operationType: 'query' | 'mutation' | 'http';
}
```

### IVoter

```typescript
interface IVoter<TData = any> {
  supports?(data: TData): boolean;
  vote?(context: VoterContext<any, TData, any>): Promise<boolean> | boolean;
}
```

### VoterException

```typescript
class VoterException extends ForbiddenException {
  constructor(message: string = "Access denied");
}
```

## Best Practices

1. **Type your contexts** - Use TypeScript generics for type safety
2. **Keep voters focused** - Each voter should handle one concern
3. **Use supports wisely** - Skip unnecessary post-authorization checks
4. **Log authorization failures** - Help debugging with clear logs
5. **Test thoroughly** - Unit test each voter method
6. **Handle null values** - Always check for missing auth or data
7. **Separate concerns** - Don't mix business logic with authorization
8. **Cache expensive queries** - Store database results in voter instance
9. **Enable strict TypeScript** - Use strict mode to catch type errors early
10. **Watch subscription performance** - Voters execute on each emitted value

## License

MIT © [Igor Ognichenko](https://github.com/RobinCK)
