// Jest setup file for test configuration
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

jest.mock('@sentry/nextjs', () => {
  const span = { setAttribute: jest.fn(), setAttributes: jest.fn() };
  return {
    __esModule: true,
    startSpan: jest.fn((_: any, callback?: (span: any) => any) => {
      if (typeof callback === 'function') {
        return callback(span);
      }
      return span;
    }),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    logger: {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      fmt: (strings: TemplateStringsArray, ...values: any[]) =>
        strings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '')
    }
  };
});

// Mock environment variables
process.env.NODE_ENV = 'test';

Object.assign(global, {
  TextEncoder,
  TextDecoder,
  Request: globalThis.Request,
  Response: globalThis.Response,
  Headers: globalThis.Headers,
  fetch: globalThis.fetch
});

// Global test utilities and mocks can be added here
global.console = {
  ...console,
  // Suppress console.log during tests unless needed
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};
