module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
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
