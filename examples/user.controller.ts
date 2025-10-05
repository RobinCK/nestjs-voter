import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { PostAuthVoter, PreAuthVoterMethod } from '../src';
import { UserVoter } from './user.voter';

@Controller('users')
export class UserController {
  @Get(':id')
  @PostAuthVoter(UserVoter)
  async getUser(@Param('id') id: string) {
    return {
      id,
      email: 'user@example.com',
      name: 'John Doe',
      role: 'user',
    };
  }

  @Get()
  async getUsers() {
    return [
      { id: '1', email: 'user1@example.com', name: 'User 1', role: 'user' },
      { id: '2', email: 'user2@example.com', name: 'User 2', role: 'admin' },
    ];
  }

  @Post()
  @PreAuthVoterMethod(UserVoter, 'canCreate')
  @PostAuthVoter(UserVoter)
  async createUser(@Body() body: { email: string; name: string }) {
    return {
      id: 'new-id',
      email: body.email,
      name: body.name,
      role: 'user',
    };
  }

  @Put(':id')
  @PreAuthVoterMethod(UserVoter, 'canUpdate')
  @PostAuthVoter(UserVoter)
  async updateUser(@Param('id') id: string, @Body() body: { email?: string; name?: string }) {
    return {
      id,
      email: body.email || 'updated@example.com',
      name: body.name || 'Updated Name',
      role: 'user',
    };
  }

  @Delete(':id')
  @PreAuthVoterMethod(UserVoter, 'canDelete')
  async deleteUser(@Param('id') id: string) {
    return { success: true };
  }
}
