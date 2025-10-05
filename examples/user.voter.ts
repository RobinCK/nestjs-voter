import { Injectable, Logger } from '@nestjs/common';
import { BaseVoter, VoterContext } from '../src';

interface CreateUserArgs {
  email: string;
  name: string;
}

interface UpdateUserArgs {
  id: string;
  email?: string;
  name?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

@Injectable()
export class UserVoter extends BaseVoter<User> {
  private readonly logger = new Logger(UserVoter.name);

  supports(data: any): boolean {
    return data && typeof data === 'object' && 'id' in data && 'email' in data;
  }

  async vote(context: VoterContext<any, User, any>): Promise<boolean> {
    const { data, auth } = context;

    if (!auth || !auth.user) {
      this.logger.debug('No authenticated user');
      return false;
    }

    const isOwner = data.id === auth.user.id;
    const isAdmin = auth.user.role === 'admin';

    return isOwner || isAdmin;
  }

  async canCreate(context: VoterContext<any, null, CreateUserArgs>): Promise<boolean> {
    const { auth } = context;

    if (!auth || !auth.user) {
      return false;
    }

    return auth.user.role === 'admin';
  }

  async canUpdate(context: VoterContext<any, null, UpdateUserArgs>): Promise<boolean> {
    const { args, auth } = context;

    if (!auth || !auth.user) {
      return false;
    }

    const isOwner = args.id === auth.user.id;
    const isAdmin = auth.user.role === 'admin';

    return isOwner || isAdmin;
  }

  async canDelete(context: VoterContext<any, null, { id: string }>): Promise<boolean> {
    const { auth } = context;

    if (!auth || !auth.user) {
      return false;
    }

    return auth.user.role === 'admin';
  }
}
