"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.presets = void 0;
exports.presets = {
    unpublishSafe: {
        description: 'Set a status check pending for 3 days from release timestamp to guard against npm unpublishing',
        npm: {
            stabilityDays: 3,
        },
    },
};
//# sourceMappingURL=npm.js.map