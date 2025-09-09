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
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  testTimeout: 10000
};
