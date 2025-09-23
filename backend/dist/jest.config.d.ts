declare const _default: {
    preset: string;
    testEnvironment: string;
    extensionsToTreatAsEsm: string[];
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": string;
    };
    globals: {
        "ts-jest": {
            useESM: boolean;
        };
    };
    testMatch: string[];
    collectCoverageFrom: string[];
    coverageDirectory: string;
    coverageReporters: string[];
    coverageThreshold: {
        global: {
            branches: number;
            functions: number;
            lines: number;
            statements: number;
        };
    };
    testTimeout: number;
    maxWorkers: number;
    forceExit: boolean;
    detectOpenHandles: boolean;
    transform: {
        "^.+\\.tsx?$": (string | {
            useESM: boolean;
        })[];
    };
    testPathIgnorePatterns: string[];
    transformIgnorePatterns: string[];
};
export default _default;
//# sourceMappingURL=jest.config.d.ts.map