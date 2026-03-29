import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { RegisterInput, LoginInput, UpdateUserInput, ChangePasswordInput } from './auth.types';

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;

  constructor(private prisma: PrismaService) {}

  async register(input: RegisterInput) {
    const { username, password, name } = input;

    // Check if username already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    // Generate salt and hash password
    const salt = await bcrypt.genSalt(this.saltRounds);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user and auth in a transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          username,
          name,
        },
      });

      await tx.auth.create({
        data: {
          userId: newUser.id,
          username,
          passwordHash,
          salt,
        },
      });

      return newUser;
    });

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      bio: user.bio,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async login(input: LoginInput) {
    const { username, password } = input;

    // Find auth record
    const auth = await this.prisma.auth.findUnique({
      where: { username },
      include: { user: true },
    });

    if (!auth) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, auth.passwordHash);

    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate a simple token (in production, use JWT)
    const token = Buffer.from(`${auth.userId}:${Date.now()}`).toString('base64');

    return {
      token,
      user: {
        id: auth.user.id,
        username: auth.user.username,
        name: auth.user.name,
        bio: auth.user.bio,
        createdAt: auth.user.createdAt,
        updatedAt: auth.user.updatedAt,
      },
    };
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      bio: user.bio,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateUser(userId: string, input: UpdateUserInput) {
    const { name, bio } = input;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name,
        bio,
      },
    });

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      bio: user.bio,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const { currentPassword, newPassword } = input;

    // Get auth record
    const auth = await this.prisma.auth.findFirst({
      where: { userId },
    });

    if (!auth) {
      throw new BadRequestException('Auth record not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, auth.passwordHash);

    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Generate new salt and hash
    const newSalt = await bcrypt.genSalt(this.saltRounds);
    const newPasswordHash = await bcrypt.hash(newPassword, newSalt);

    // Update auth record
    await this.prisma.auth.update({
      where: { id: auth.id },
      data: {
        passwordHash: newPasswordHash,
        salt: newSalt,
      },
    });

    return true;
  }
}
