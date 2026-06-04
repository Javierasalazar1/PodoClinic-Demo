import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../src/pages/LoginPage';
import { describe, it, expect } from 'vitest';

describe('LoginPage', () => {
  it('renders login form with email and password fields', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    // Match actual placeholders in LoginPage.tsx
    expect(screen.getByPlaceholderText('especialista@clinica.cl')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    // Button shows "Ingresar" (not requiresTotp state)
    expect(screen.getByRole('button', { name: /Ingresar/i })).toBeInTheDocument();
  });
});
