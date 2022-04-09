import { Field, Int, ObjectType } from "type-graphql";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  BaseEntity,
  CreateDateColumn,
  RelationId,
  ManyToOne,
  ManyToMany
} from "typeorm";
import { Post } from "../post";

import { Author, User } from "../user";

@ObjectType()
export class CommunityBase extends BaseEntity {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column("text", { unique: true })
  name: string;

  @Field(() => String)
  @Column("text")
  summary: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  avatar: string;
}

@ObjectType()
@Entity()
export class Community extends CommunityBase {
  @Field(() => String)
  @Column("text")
  rules: string;

  @Field(() => Int)
  @Column()
  authorId: number;

  @Field(() => Author)
  @ManyToOne(() => User, (user) => user.communities)
  author: User;

  @Field(() => Int)
  @Column({ type: "int", default: 0 })
  totalPosts: number;

  @Field(() => Int)
  @Column({ type: "int", default: 0 })
  totalUsers: number;

  @Field(() => Int, { nullable: true })
  subcriptionStatus: 1 | null;

  @RelationId((comm: Community) => comm.posts)
  postIds: number[];

  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];

  @RelationId((comm: Community) => comm.followers)
  followerIds: number[];

  @ManyToMany(() => User, (user) => user.followingCommunities)
  followers: User[];

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date;
}
