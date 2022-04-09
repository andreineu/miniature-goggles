import {
  Arg,
  Args,
  Ctx,
  FieldResolver,
  Int,
  Mutation,
  Query,
  Resolver,
  Root,
  UseMiddleware
} from "type-graphql";
import { COOKIE_NAME } from "../constants";

import { Community } from "../entity/community";

import {
  FollowAction,
  User,
  UserLoginArgs,
  UserRegisterArgs,
  UserResponse,
  UserUpdateArgs
} from "../entity/user";
import { MyContext } from "../types";
import { hashPassword, isPasswordValid } from "../utils/auth";

import { IsAuth } from "../utils/middleware/isAuth";

import {
  validateRegisterArgs,
  validateRegisterError
} from "../utils/validations";

@Resolver(User)
export class UserResolver {
  @FieldResolver(() => Int, { nullable: true })
  @UseMiddleware(IsAuth({ throwError: false, returnValue: null }))
  async followStatus(
    @Root() user: User,
    @Ctx() { req, userLoader }: MyContext
  ) {
    const uid = req.session.userId;
    const userMe = await userLoader.clear(uid).load(uid);
    const status = userMe.followingUserIds.includes(user.id) ? 1 : null;
    return status;
  }

  @Query(() => User, { nullable: true })
  @UseMiddleware(IsAuth({ returnValue: null, throwError: false }))
  async me(@Ctx() { req }: MyContext): Promise<User> {
    const user = await User.findOne({
      where: { id: req.session.userId }
    });

    return user;
  }

  @Query(() => User)
  async user(@Arg("username") username: string): Promise<User> {
    const user = await User.findOne({
      where: { username }
    });
    return user;
  }

  @Query(() => [User])
  async users() {
    const users = await User.find();
    return users;
  }

  @Mutation(() => UserResponse)
  async login(
    @Args(() => UserLoginArgs) args: UserLoginArgs,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const { usernameOrEmail, password } = args;
    const isEmail = usernameOrEmail.includes("@");

    const user = await User.findOne(
      isEmail
        ? { where: { email: usernameOrEmail } }
        : { where: { username: usernameOrEmail } }
    );
    if (!user) {
      return {
        errors: [{ field: "usernameOrEmail", message: "user does not exist" }]
      };
    }
    const isValid = await isPasswordValid(password, user.password);
    if (!isValid) {
      return { errors: [{ field: "password", message: "wrong password" }] };
    }
    req.session.userId = user.id;
    return { user };
  }

  @Mutation(() => UserResponse)
  async register(
    @Args(() => UserRegisterArgs) args: UserRegisterArgs,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const { email, password, username } = args;
    const errors = validateRegisterArgs(args);
    if (errors) {
      return { errors };
    }

    const hashedPassword = await hashPassword(password);

    let user: User;
    try {
      user = await User.create({
        username,
        email,
        password: hashedPassword
      }).save();
    } catch (err) {
      const errors = validateRegisterError(err);
      return errors;
    }

    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME);
        if (err) {
          resolve(false);
          return;
        }

        resolve(true);
      })
    );
  }

  @Mutation(() => Boolean)
  updateUser(
    @Arg("userId", () => Int) userId: number,
    @Args(() => UserUpdateArgs) args: UserUpdateArgs,
    @Ctx() { req }: MyContext
  ) {
    const uid = req.session.userId;
    if (uid !== userId) return false;

    User.update(uid, args);
    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(IsAuth())
  async followCommunity(
    @Arg("communityId", () => Int) communityId: number,
    @Arg("action", () => FollowAction) action: FollowAction,
    @Ctx() { req }: MyContext
  ) {
    if (req.session.userId === communityId) return false;

    const user = await User.findOne({
      where: { id: req.session.userId },
      relations: { followingCommunities: true }
    });

    const community = await Community.findOne({
      where: {
        id: communityId
      }
    });

    if (action === FollowAction.UNFOLLOW) {
      const valid = user.followingCommunities.findIndex(
        (c) => c.id === communityId
      );
      if (valid === -1) return false;

      user.followingCommunities = user.followingCommunities.filter(
        (c) => c.id !== communityId
      );
      user.save();
      community.totalUsers--;
      community.save();

      return true;
    }

    user.followingCommunities = [
      ...(user.followingCommunities || []),
      community
    ];
    community.totalUsers++;
    community.save();
    user.save();

    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(IsAuth())
  async followUser(
    @Arg("userId", () => Int) userId: number,
    @Arg("action", () => FollowAction) action: FollowAction,
    @Ctx() { req }: MyContext
  ) {
    if (req.session.userId === userId) return false;

    const user = await User.findOne({
      where: { id: req.session.userId },
      relations: { followingUsers: true }
    });

    const creator = await User.findOne({
      where: {
        id: userId
      }
    });

    if (action === FollowAction.UNFOLLOW) {
      const valid = user.followingUsers.findIndex((u) => u.id === userId);
      if (valid === -1) return false;

      user.followingUsers = user.followingUsers.filter((u) => u.id !== userId);
      user.save();
      creator.totalFollowers--;
      creator.save();
      return true;
    }

    user.followingUsers = [...(user.followingUsers || []), creator];
    await user.save();
    creator.totalFollowers++;
    creator.save();
    return true;
  }
}