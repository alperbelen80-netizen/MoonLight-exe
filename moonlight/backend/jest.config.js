module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  // v2.7.0: documented coverage targets.
  // These only enforce when running `yarn test:cov` (which passes
  // `--coverage`). The everyday `yarn test` run stays fast and unaffected.
  // Adjust upward as the suite grows.
  coverageThreshold: {
    global: {
      statements: 60,
      branches: 50,
      functions: 55,
      lines: 60,
    },
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@execution/(.*)$': '<rootDir>/execution/$1',
    '^@risk/(.*)$': '<rootDir>/risk/$1',
    '^@data/(.*)$': '<rootDir>/data/$1',
    '^@strategy/(.*)$': '<rootDir>/strategy/$1',
    '^@broker/(.*)$': '<rootDir>/broker/$1',
  },
  testTimeout: 10000,
};
