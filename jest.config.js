/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  watchman: false,
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^~/(.*)$': '<rootDir>/public/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  testMatch: ['**/__tests__/**/*.(ts|tsx)', '**/*.(test|spec).(ts|tsx)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'es2019',
          module: 'commonjs',
          jsx: 'react-jsx',
          esModuleInterop: true,
          isolatedModules: true
        }
      }
    ]
  },
  collectCoverageFrom: [
    'src/**/*.(ts|tsx)',
    '!src/**/*.d.ts',
    '!src/**/*.stories.(ts|tsx)',
    '!src/test-setup.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    'src/lib/providers/**/*.ts': {
      statements: 85,
      branches: 65,
      functions: 75,
      lines: 85
    },
    'src/lib/portfolio/**/*.ts': {
      statements: 85,
      branches: 60,
      functions: 90,
      lines: 85
    },
    'src/lib/watchlist/**/*.ts': {
      statements: 65,
      branches: 55,
      functions: 75,
      lines: 65
    },
    'src/app/api/portfolio/**/*.ts': {
      statements: 85,
      branches: 75,
      functions: 100,
      lines: 85
    },
    'src/app/api/watchlist/**/*.ts': {
      statements: 80,
      branches: 65,
      functions: 100,
      lines: 80
    },
    'src/app/api/stocks/**/*.ts': {
      statements: 75,
      branches: 55,
      functions: 90,
      lines: 75
    },
    'src/app/api/ws/**/*.ts': {
      statements: 75,
      branches: 55,
      functions: 80,
      lines: 75
    },
    'src/features/stock-dashboard/components/PortfolioCard.tsx': {
      statements: 80,
      branches: 60,
      functions: 80,
      lines: 80
    },
    'src/middleware.ts': {
      statements: 90,
      branches: 75,
      functions: 100,
      lines: 90
    }
  },
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  testTimeout: 10000
};
