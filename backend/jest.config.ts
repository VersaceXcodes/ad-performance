module.exports = {
  "preset": "ts-jest/presets/default-esm",
  "testEnvironment": "node",
  "extensionsToTreatAsEsm": [".ts"],
  "moduleNameMapper": {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },

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

  "transform": {
    "^.+\\.tsx?$": ["ts-jest", {
      "useESM": true
    }]
  },
  "transformIgnorePatterns": [
    "node_modules/(?!(module-that-needs-to-be-transformed)/)"
  ]
};