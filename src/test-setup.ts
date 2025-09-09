// Jest setup file for test configuration
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Mock environment variables
process.env.NODE_ENV = 'test';

// Add Web APIs that aren't available in Node.js test environment
Object.assign(global, {
  TextEncoder,
  TextDecoder,
  Request: class Request {
    constructor(
      public url: string,
      public init: RequestInit = {}
    ) {}
    headers = new Map();
  },
  Response: class Response {
    constructor(
      public body: any,
      public init: ResponseInit = {}
    ) {}
    static json(object: any) {
      return new Response(JSON.stringify(object), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },
  Headers: class Headers extends Map {}
});

// Global test utilities and mocks can be added here
global.console = {
  ...console,
  // Suppress console.log during tests unless needed
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};
