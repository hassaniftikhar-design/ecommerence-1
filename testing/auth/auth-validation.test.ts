import {
  validateSignupInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
  validateChangePasswordInput,
  validateResetTokenInput,
  validateVerificationTokenInput
} from '@/server/middlewares/auth.middleware';

import {
  mockSignupPayload,
  mockForgotPasswordPayload,
  mockResetPasswordPayload,
  mockChangePasswordPayload
} from '../mocks/auth.mock';

describe('Auth Validation Middlewares (auth.middleware.ts & validators.ts)', () => {
  /* -------------------------------------------------------------------------- */
  /*                            validateSignupInput                             */
  /* -------------------------------------------------------------------------- */
  describe('validateSignupInput', () => {
    it('should succeed with valid signup payload', () => {
      const result = validateSignupInput(mockSignupPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe(mockSignupPayload.email);
        expect(result.data.fullName).toBe(mockSignupPayload.fullName);
      }
    });

    it('should fail when fullName is less than 2 characters', () => {
      const result = validateSignupInput({
        ...mockSignupPayload,
        fullName: 'A'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(400);
        expect(result.message).toContain('Enter your full name');
      }
    });

    it('should fail when email is invalid format', () => {
      const result = validateSignupInput({
        ...mockSignupPayload,
        email: 'not-an-email'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(400);
        expect(result.message).toContain('Enter a valid email address');
      }
    });

    it('should safely reject extremely long malformed email without crashing', () => {
      const extremelyLongMalformedEmail = 'invalid_email_format_' + 'a'.repeat(1000) + '_not_an_email';
      const result = validateSignupInput({
        ...mockSignupPayload,
        email: extremelyLongMalformedEmail
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(400);
        expect(result.message).toContain('Enter a valid email address');
      }
    });

    it('should handle extremely long inputs (5,000+ characters) safely without crashing', () => {
      const extremelyLongName = 'A'.repeat(5000);
      const extremelyLongPassword = 'Password123!' + 'X'.repeat(5000);

      const result = validateSignupInput({
        ...mockSignupPayload,
        fullName: extremelyLongName,
        password: extremelyLongPassword,
        confirmPassword: extremelyLongPassword
      });

      // Validates structural correctness without server crash
      expect(result.success).toBe(true);
    });

    it('should preserve password leading/trailing whitespace without silent trimming', () => {
      const passwordWithSpaces = ' Password123! ';
      const result = validateSignupInput({
        ...mockSignupPayload,
        password: passwordWithSpaces,
        confirmPassword: passwordWithSpaces
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.password).toBe(' Password123! ');
        expect(result.data.confirmPassword).toBe(' Password123! ');
      }
    });

    it('should fail when password is less than 8 characters', () => {
      const result = validateSignupInput({
        ...mockSignupPayload,
        password: 'Pass1!',
        confirmPassword: 'Pass1!'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.message).toContain('Password must be at least 8 characters');
      }
    });

    it('should fail when password lacks uppercase letter', () => {
      const result = validateSignupInput({
        ...mockSignupPayload,
        password: 'password123!',
        confirmPassword: 'password123!'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.message).toContain('Password must contain at least one uppercase letter');
      }
    });

    it('should fail when password lacks number', () => {
      const result = validateSignupInput({
        ...mockSignupPayload,
        password: 'Password!',
        confirmPassword: 'Password!'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.message).toContain('Password must contain at least one number');
      }
    });

    it('should fail when password lacks special character', () => {
      const result = validateSignupInput({
        ...mockSignupPayload,
        password: 'Password123',
        confirmPassword: 'Password123'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.message).toContain('Password must contain at least one special character');
      }
    });

    it('should fail when confirmPassword does not match password', () => {
      const result = validateSignupInput({
        ...mockSignupPayload,
        password: 'Password123!',
        confirmPassword: 'DifferentPassword123!'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.message).toContain('Passwords must match');
      }
    });

    it('should allow valid international phone number format or omit phone', () => {
      const withValidPhone = validateSignupInput({
        ...mockSignupPayload,
        mobile: '+1 555-123-4567'
      });
      expect(withValidPhone.success).toBe(true);

      const withoutPhone = validateSignupInput({
        ...mockSignupPayload,
        mobile: undefined
      });
      expect(withoutPhone.success).toBe(true);
    });

    it('should fail when phone number has invalid characters or fewer than 10 digits', () => {
      const result = validateSignupInput({
        ...mockSignupPayload,
        mobile: '123-abc-456'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.message).toContain('Enter a valid phone number');
      }
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                        validateForgotPasswordInput                         */
  /* -------------------------------------------------------------------------- */
  describe('validateForgotPasswordInput', () => {
    it('should succeed with a valid email', () => {
      const result = validateForgotPasswordInput(mockForgotPasswordPayload);
      expect(result.success).toBe(true);
    });

    it('should fail when email is invalid format', () => {
      const result = validateForgotPasswordInput({ email: 'invalid-email-address' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(400);
        expect(result.message).toContain('Enter a valid email address');
      }
    });

    it('should fail when email contains untrimmed spaces in raw schema validation', () => {
      const result = validateForgotPasswordInput({ email: ' user@example.com ' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(400);
        expect(result.message).toContain('Enter a valid email address');
      }
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                         validateResetPasswordInput                         */
  /* -------------------------------------------------------------------------- */
  describe('validateResetPasswordInput', () => {
    it('should succeed with valid reset password payload', () => {
      const result = validateResetPasswordInput(mockResetPasswordPayload);
      expect(result.success).toBe(true);
    });

    it('should fail when token is missing', () => {
      const result = validateResetPasswordInput({
        ...mockResetPasswordPayload,
        token: ''
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.message).toContain('Missing reset token');
      }
    });

    it('should fail when passwords do not match', () => {
      const result = validateResetPasswordInput({
        ...mockResetPasswordPayload,
        password: 'NewPassword123!',
        confirmPassword: 'MismatchedPassword123!'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.message).toContain('Passwords must match');
      }
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                        validateChangePasswordInput                         */
  /* -------------------------------------------------------------------------- */
  describe('validateChangePasswordInput', () => {
    it('should succeed with valid change password payload', () => {
      const result = validateChangePasswordInput(mockChangePasswordPayload);
      expect(result.success).toBe(true);
    });

    it('should fail when current password is empty', () => {
      const result = validateChangePasswordInput({
        ...mockChangePasswordPayload,
        currentPassword: ''
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.message).toContain('Enter your current password');
      }
    });

    it('should fail when new passwords do not match', () => {
      const result = validateChangePasswordInput({
        ...mockChangePasswordPayload,
        newPassword: 'NewPassword123!',
        confirmPassword: 'WrongConfirmation123!'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.message).toContain('Passwords must match');
      }
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                          validateResetTokenInput                           */
  /* -------------------------------------------------------------------------- */
  describe('validateResetTokenInput', () => {
    it('should succeed for a valid string token', () => {
      const result = validateResetTokenInput('valid-reset-token-123');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('valid-reset-token-123');
      }
    });

    it('should trim surrounding whitespace from reset token string', () => {
      const result = validateResetTokenInput('  valid-reset-token-123  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('valid-reset-token-123');
      }
    });

    it('should fail for null, undefined, or empty/whitespace string', () => {
      expect(validateResetTokenInput(null).success).toBe(false);
      expect(validateResetTokenInput(undefined).success).toBe(false);
      expect(validateResetTokenInput('').success).toBe(false);
      expect(validateResetTokenInput('   ').success).toBe(false);
      expect(validateResetTokenInput(12345).success).toBe(false);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                       validateVerificationTokenInput                       */
  /* -------------------------------------------------------------------------- */
  describe('validateVerificationTokenInput', () => {
    it('should succeed for a valid string verification token', () => {
      const result = validateVerificationTokenInput('valid-verify-token-123');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('valid-verify-token-123');
      }
    });

    it('should trim surrounding whitespace from verification token string', () => {
      const result = validateVerificationTokenInput('  valid-verify-token-123  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('valid-verify-token-123');
      }
    });

    it('should fail for null, undefined, or empty/whitespace string', () => {
      expect(validateVerificationTokenInput(null).success).toBe(false);
      expect(validateVerificationTokenInput(undefined).success).toBe(false);
      expect(validateVerificationTokenInput('').success).toBe(false);
      expect(validateVerificationTokenInput('   ').success).toBe(false);
      expect(validateVerificationTokenInput({}).success).toBe(false);
    });
  });
});
