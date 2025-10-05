import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UserVoter } from './user.voter';
import { PostAuthVoter, PreAuthVoter, PreAuthVoterMethod } from '../src';

@Resolver('User')
export class UserResolver {
  @Query()
  @PostAuthVoter(UserVoter)
  async user(@Args('id') id: string) {
    return {
      id,
      email: 'user@example.com',
      name: 'John Doe',
      role: 'user',
    };
  }

  @Query()
  @PostAuthVoter((context) => {
    return context.data.every((user) => user.isPublic || user.id === context.auth.user.id);
  })
  async users() {
    return [
      { id: '1', email: 'user1@example.com', name: 'User 1', role: 'user', isPublic: true },
      { id: '2', email: 'user2@example.com', name: 'User 2', role: 'admin', isPublic: false },
    ];
  }

  @Mutation()
  @PreAuthVoterMethod(UserVoter, 'canCreate')
  @PostAuthVoter(UserVoter)
  async createUser(@Args('email') email: string, @Args('name') name: string) {
    return {
      id: 'new-id',
      email,
      name,
      role: 'user',
    };
  }

  @Mutation()
  @PreAuthVoterMethod(UserVoter, 'canUpdate')
  @PostAuthVoter(UserVoter)
  async updateUser(@Args('id') id: string, @Args('email') email?: string, @Args('name') name?: string) {
    return {
      id,
      email: email || 'updated@example.com',
      name: name || 'Updated Name',
      role: 'user',
    };
  }

  @Mutation()
  @PreAuthVoter((context) => {
    return context.auth.user.role === 'admin';
  })
  async deleteUser(@Args('id') id: string) {
    return { success: true };
  }
}
