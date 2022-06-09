"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.presets = void 0;
exports.presets = {
    dockerCompose: {
        description: 'Enable Docker Compose image updating',
        'docker-compose': {
            enabled: true,
        },
    },
    dockerVersions: {
        description: 'Upgrade Docker tags to newer versions',
        docker: {
            major: {
                enabled: true,
            },
            minor: {
                enabled: true,
            },
        },
    },
    buildkite: {
        description: 'Enable Buildkite functionality',
        buildkite: {
            enabled: true,
        },
    },
};
//# sourceMappingURL=preview.js.map