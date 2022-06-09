"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionStrategyMigration = void 0;
const abstract_migration_1 = require("../base/abstract-migration");
class VersionStrategyMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.deprecated = true;
        this.propertyName = 'versionStrategy';
    }
    run(value) {
        if (value === 'widen') {
            this.setSafely('rangeStrategy', 'widen');
        }
    }
}
exports.VersionStrategyMigration = VersionStrategyMigration;
//# sourceMappingURL=version-strategy-migration.js.map