"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComposerIgnorePlatformReqsMigration = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const abstract_migration_1 = require("../base/abstract-migration");
class ComposerIgnorePlatformReqsMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.propertyName = 'composerIgnorePlatformReqs';
    }
    run(value) {
        if (is_1.default.boolean(value)) {
            this.rewrite(value ? [] : null);
        }
    }
}
exports.ComposerIgnorePlatformReqsMigration = ComposerIgnorePlatformReqsMigration;
//# sourceMappingURL=composer-ignore-platform-reqs-migration.js.map