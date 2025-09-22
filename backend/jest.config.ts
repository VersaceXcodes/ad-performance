module.exports = {
  "preset": "ts-jest",
  "testEnvironment": "node",
  "setupFilesAfterEnv": [
    "<rootDir>/tests/setup.ts"
  ],
  "testMatch": [
    "**/__tests__/**/*.(ts|js)",
    "**/*.(test|spec).(ts|js)"
  ],
  "collectCoverageFrom": [
    "src/**/*.{ts,js}",
    "!src/**/*.d.ts",
    "!src/types/**/*",
    "!src/migrations/**/*"
  ],
  "coverageDirectory": "coverage",
  "coverageReporters": [
    "text",
    "lcov",
    "html"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  },
  "testTimeout": 30000,
  "maxWorkers": 1,
  "forceExit": true,
  "detectOpenHandles": true,
  "setupFiles": [
    "<rootDir>/tests/env.ts"
  ],
  "moduleNameMapping": {
    "^@/(.*)$": "<rootDir>/src/$1"
  },
  "transform": {
    "^.+\\.tsx?$": "ts-jest"
  },
  "transformIgnorePatterns": [
    "node_modules/(?!(module-that-needs-to-be-transformed)/)"
  ]
};