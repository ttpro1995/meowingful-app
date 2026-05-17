import { validate } from 'class-validator';
import {
  RegisterInput,
  LoginInput,
  UpdateUserInput,
  UpdateUserProfileInput,
  ChangePasswordInput,
  UsersQueryInput,
} from './auth.types';

describe('Auth Types Validation', () => {
  describe('RegisterInput', () => {
    it('should pass validation with valid data', async () => {
      const input = new RegisterInput();
      input.username = 'testuser';
      input.password = 'password123';
      input.name = 'Test User';

      const errors = await validate(input);
      expect(errors.length).toBe(0);
    });

    it('should fail validation when username is empty', async () => {
      const input = new RegisterInput();
      input.username = '';
      input.password = 'password123';
      input.name = 'Test User';

      const errors = await validate(input);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('username');
    });

    it('should fail validation when password is too short', async () => {
      const input = new RegisterInput();
      input.username = 'testuser';
      input.password = 'short';
      input.name = 'Test User';

      const errors = await validate(input);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('password');
    });

    it('should fail validation when name is empty', async () => {
      const input = new RegisterInput();
      input.username = 'testuser';
      input.password = 'password123';
      input.name = '';

      const errors = await validate(input);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('name');
    });
  });

  describe('LoginInput', () => {
    it('should pass validation with valid data', async () => {
      const input = new LoginInput();
      input.username = 'testuser';
      input.password = 'password123';

      const errors = await validate(input);
      expect(errors.length).toBe(0);
    });

    it('should fail validation when username is too short', async () => {
      const input = new LoginInput();
      input.username = 'ab';
      input.password = 'password123';

      const errors = await validate(input);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('username');
    });

    it('should fail validation when username is too long', async () => {
      const input = new LoginInput();
      input.username = 'a'.repeat(31);
      input.password = 'password123';

      const errors = await validate(input);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('username');
    });
  });

  describe('UpdateUserInput', () => {
    it('should be defined', () => {
      const input = new UpdateUserInput();
      expect(input).toBeDefined();
    });
  });

  describe('UpdateUserProfileInput', () => {
    it('should be defined', () => {
      const input = new UpdateUserProfileInput();
      expect(input).toBeDefined();
    });
  });

  describe('ChangePasswordInput', () => {
    it('should pass validation with valid data', async () => {
      const input = new ChangePasswordInput();
      input.currentPassword = 'oldpassword';
      input.newPassword = 'newpassword';

      const errors = await validate(input);
      expect(errors.length).toBe(0);
    });

    it('should fail validation when current password is empty', async () => {
      const input = new ChangePasswordInput();
      input.currentPassword = '';
      input.newPassword = 'newpassword';

      const errors = await validate(input);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('currentPassword');
    });

    it('should fail validation when new password is too short', async () => {
      const input = new ChangePasswordInput();
      input.currentPassword = 'oldpassword';
      input.newPassword = 'short';

      const errors = await validate(input);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('newPassword');
    });
  });

  describe('UsersQueryInput', () => {
    it('should pass validation with empty query', async () => {
      const input = new UsersQueryInput();

      const errors = await validate(input);
      expect(errors.length).toBe(0);
    });

    it('should pass validation with valid pagination params', async () => {
      const input = new UsersQueryInput();
      input.first = 10;
      input.after = 'cursor123';
      input.includeDeleted = false;

      const errors = await validate(input);
      expect(errors.length).toBe(0);
    });

    it('should pass validation with last and before params', async () => {
      const input = new UsersQueryInput();
      input.last = 5;
      input.before = 'cursor456';

      const errors = await validate(input);
      expect(errors.length).toBe(0);
    });

    it('should fail validation when first is not an integer', async () => {
      const input = new UsersQueryInput();
      input.first = 10.5;

      const errors = await validate(input);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
