"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompatibilityMigration = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const abstract_migration_1 = require("../base/abstract-migration");
class CompatibilityMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.deprecated = true;
        this.propertyName = 'compatibility';
    }
    run(value) {
        if (is_1.default.object(value)) {
            this.setSafely('constraints', value);
        }
    }
}
exports.CompatibilityMigration = CompatibilityMigration;
//# sourceMappingURL=compatibility-migration.js.map