/**
 * ErrorBoundary Component Tests
 * Tests for the TypeScript migrated ErrorBoundary component
 * 
 * Migrated to TypeScript with comprehensive type safety for error boundary testing.
 */

import React from 'react';
import { render, screen, fireEvent, RenderResult } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

/**
 * Type definitions for test components
 */
interface ThrowErrorProps {
  shouldThrow: boolean;
}

// Component that throws an error for testing
const ThrowError: React.FC<ThrowErrorProps> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  // Suppress console.error for these tests
  let originalError: typeof console.error;
  
  beforeAll(() => {
    originalError = console.error;
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  afterEach(() => {
    // Clear mock calls between tests
    (console.error as jest.Mock).mockClear();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders error UI when child component throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/We encountered an unexpected error/)).toBeInTheDocument();
  });

  it('shows error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Error: Test error/)).toBeInTheDocument();
    
    // Can toggle error details
    const toggleButton = screen.getByText(/Show Error Details/);
    fireEvent.click(toggleButton);
    expect(screen.getByText(/Hide Error Details/)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('hides error details in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Error message should not be shown in production
    expect(screen.queryByText(/Error: Test error/)).not.toBeInTheDocument();
    // Error details toggle should not be shown
    expect(screen.queryByText(/Show Error Details/)).not.toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('provides recovery options', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Go Home')).toBeInTheDocument();
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
  });

  it('can reset error state', () => {
    const { rerender }: RenderResult = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();

    // Click Try Again
    fireEvent.click(screen.getByText('Try Again'));

    // Rerender with non-throwing component
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('calls onError callback when error occurs', () => {
    const onErrorMock = jest.fn();

    render(
      <ErrorBoundary onError={onErrorMock}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onErrorMock).toHaveBeenCalledTimes(1);
    expect(onErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    );
  });

  it('calls onReset callback when reset is triggered', () => {
    const onResetMock = jest.fn();

    render(
      <ErrorBoundary onReset={onResetMock}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Try Again'));

    expect(onResetMock).toHaveBeenCalledTimes(1);
  });

  it('renders custom fallback when provided', () => {
    const customFallback = (error: Error) => (
      <div>Custom error message: {error.message}</div>
    );

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error message: Test error')).toBeInTheDocument();
    // Default error UI should not be rendered
    expect(screen.queryByText('Oops! Something went wrong')).not.toBeInTheDocument();
  });

  it('logs errors to console in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(console.error).toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });

  it('handles multiple sequential errors', () => {
    const { rerender }: RenderResult = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();

    // Reset the error
    fireEvent.click(screen.getByText('Try Again'));

    // Render another throwing component
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Should show error UI again
    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
  });

  it('handles errors with missing error info', () => {
    // This test ensures the component handles edge cases gracefully
    const BrokenComponent: React.FC = () => {
      throw new Error('Error without componentStack');
    };

    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
  });
});