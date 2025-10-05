import { Injectable, Logger } from '@nestjs/common';
import { BaseVoter, VoterContext } from '../src';

interface PostDto {
  id: string;
  authorId: string;
  title: string;
  content: string;
}

interface PaginationDto<T> {
  records: T[];
  total: number;
}

interface GetPostsArgs {
  pageIndex: number;
  pageSize: number;
  authorId?: string;
}

interface UpdatePostArgs {
  id: string;
  title?: string;
  content?: string;
}

interface DeletePostArgs {
  id: string;
}

type PostVoterData = PostDto | PostDto[] | PaginationDto<PostDto>;

@Injectable()
export class PostVoter extends BaseVoter<PostVoterData> {
  private readonly logger = new Logger(PostVoter.name);

  constructor(private readonly postService: any) {
    super();
  }

  supports(data: any): boolean {
    if (!data) return false;

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
      return data.every((item) => this.checkAccess(item, auth));
    }

    if (this.isPaginationDto(data)) {
      return data.records.every((item) => this.checkAccess(item, auth));
    }

    return this.checkAccess(data as PostDto, auth);
  }

  async canGetPosts(context: VoterContext<any, null, GetPostsArgs>): Promise<boolean> {
    const { args, auth } = context;

    if (!auth || !auth.user) {
      return false;
    }

    if (args.authorId && args.authorId !== auth.user.id) {
      return auth.user.role === 'admin';
    }

    return true;
  }

  async canUpdate(context: VoterContext<any, null, UpdatePostArgs>): Promise<boolean> {
    const { args, auth } = context;

    if (!auth || !auth.user) {
      return false;
    }

    const post = await this.postService.findById(args.id);

    if (!post) {
      this.logger.debug(`Post ${args.id} not found`);
      return false;
    }

    return post.authorId === auth.user.id || auth.user.role === 'admin';
  }

  async canDelete(context: VoterContext<any, null, DeletePostArgs>): Promise<boolean> {
    const { args, auth } = context;

    if (!auth || !auth.user) {
      return false;
    }

    const post = await this.postService.findById(args.id);

    if (!post) {
      this.logger.debug(`Post ${args.id} not found`);
      return false;
    }

    return post.authorId === auth.user.id || auth.user.role === 'admin';
  }

  private checkAccess(post: PostDto, auth: any): boolean {
    if (!auth || !auth.user) {
      return false;
    }

    return post.authorId === auth.user.id || auth.user.role === 'admin';
  }

  private isPostDto(obj: any): obj is PostDto {
    return obj && typeof obj === 'object' && 'id' in obj && 'authorId' in obj;
  }

  private isPaginationDto(obj: any): obj is PaginationDto<any> {
    return obj && typeof obj === 'object' && 'records' in obj && Array.isArray(obj.records);
  }
}
