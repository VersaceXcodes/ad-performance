import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

import UV_SignUp from '@/components/views/UV_SignUp';
import UV_SignIn from '@/components/views/UV_SignIn';
import { useAppStore } from '@/store/main';

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('Auth E2E (real API): register → logout → sign-in', () => {
  beforeEach(() => {
    // Clear persisted state between tests
    localStorage.clear();
    // Ensure store starts unauthenticated and not loading
    useAppStore.setState((state) => ({
      authentication_state: {
        ...state.authentication_state,
        current_user: null,
        auth_token: null,
        authentication_status: {
          is_authenticated: false,
          is_loading: false,
        },
        error_message: null,
      },
      current_workspace: null,
    }));
  });

  it('registers a new user, logs out, and signs in successfully', async () => {
    // Use a unique email to avoid collisions
    const uniqueEmail = `user${Date.now()}@example.com`;
    const password = 'ValidPass123';
    const fullName = 'Test User';

    // 1) Register new user via the Sign Up screen
    render(<UV_SignUp />, { wrapper: Wrapper });

    const emailInput = await screen.findByLabelText(/email address|email/i);
    const nameInput = await screen.findByLabelText(/full name|name/i);
    const passwordInput = await screen.findByLabelText(/password/i);

    await waitFor(() => {
      expect(emailInput).not.toBeDisabled();
      expect(passwordInput).not.toBeDisabled();
    });

    const user = userEvent.setup();

    await user.type(emailInput, uniqueEmail);
    await user.type(nameInput, fullName);
    await user.type(passwordInput, password);

    // Accept terms (label text includes Terms/Privacy)
    const termsCheckbox = screen.getByRole('checkbox', { name: /terms|privacy/i });
    await user.click(termsCheckbox);

    // Submit the form
    const registerButton = screen.getByRole('button', { name: /register|sign up|create/i });
    await waitFor(() => expect(registerButton).not.toBeDisabled());
    await user.click(registerButton);

    // Wait for store to reflect authenticated state
    await waitFor(
      () => {
        const state = useAppStore.getState();
        expect(state.authentication_state.authentication_status.is_authenticated).toBe(true);
        expect(state.authentication_state.auth_token).toBeTruthy();
      },
      { timeout: 30000 }
    );

    // 2) Logout via store action
    useAppStore.getState().logout_user();
    await waitFor(() => {
      const state = useAppStore.getState();
      expect(state.authentication_state.authentication_status.is_authenticated).toBe(false);
      expect(state.authentication_state.auth_token).toBeNull();
    });

    // 3) Sign in with the same credentials via the Sign In screen
    render(<UV_SignIn />, { wrapper: Wrapper });

    const signinEmailInput = await screen.findByLabelText(/email address|email/i);
    const signinPasswordInput = await screen.findByLabelText(/password/i);

    await waitFor(() => {
      expect(signinEmailInput).not.toBeDisabled();
      expect(signinPasswordInput).not.toBeDisabled();
    });

    await user.type(signinEmailInput, uniqueEmail);
    await user.type(signinPasswordInput, password);

    const signInButton = screen.getByRole('button', { name: /sign in|log in/i });
    await waitFor(() => expect(signInButton).not.toBeDisabled());
    await user.click(signInButton);

    // Wait for authenticated state again
    await waitFor(
      () => {
        const state = useAppStore.getState();
        expect(state.authentication_state.authentication_status.is_authenticated).toBe(true);
        expect(state.authentication_state.auth_token).toBeTruthy();
      },
      { timeout: 30000 }
    );
  }, 60000);
});
