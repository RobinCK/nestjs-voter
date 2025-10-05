import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { PostVoter } from './post.voter';
import { PostAuthVoter, PreAuthVoter, PreAuthVoterMethod } from '../src';

@Resolver('Post')
export class PostResolver {
  constructor(private readonly postService: any) {}

  @Query()
  @PreAuthVoterMethod(PostVoter, 'canGetPosts')
  @PostAuthVoter(PostVoter)
  async posts(
    @Args('pageIndex') pageIndex: number,
    @Args('pageSize') pageSize: number,
    @Args('authorId', { nullable: true }) authorId?: string,
  ) {
    const posts = await this.postService.findAll(pageIndex, pageSize, authorId);

    return {
      records: posts,
      total: await this.postService.count(authorId),
    };
  }

  @Query()
  @PostAuthVoter(PostVoter)
  async post(@Args('id') id: string) {
    return this.postService.findById(id);
  }

  @Mutation()
  @PreAuthVoter((context) => {
    return context.auth?.user?.role === 'user' || context.auth?.user?.role === 'admin';
  })
  @PostAuthVoter(PostVoter)
  async createPost(@Args('title') title: string, @Args('content') content: string) {
    return this.postService.create({ title, content });
  }

  @Mutation()
  @PreAuthVoterMethod(PostVoter, 'canUpdate')
  @PostAuthVoter(PostVoter)
  async updatePost(
    @Args('id') id: string,
    @Args('title', { nullable: true }) title?: string,
    @Args('content', { nullable: true }) content?: string,
  ) {
    return this.postService.update(id, { title, content });
  }

  @Mutation()
  @PreAuthVoterMethod(PostVoter, 'canDelete')
  async deletePost(@Args('id') id: string) {
    return this.postService.delete(id);
  }
}
