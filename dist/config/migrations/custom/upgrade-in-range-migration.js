"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpgradeInRangeMigration = void 0;
const abstract_migration_1 = require("../base/abstract-migration");
class UpgradeInRangeMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.deprecated = true;
        this.propertyName = 'upgradeInRange';
    }
    run(value) {
        if (value === true) {
            this.setSafely('rangeStrategy', 'bump');
        }
    }
}
exports.UpgradeInRangeMigration = UpgradeInRangeMigration;
//# sourceMappingURL=upgrade-in-range-migration.js.map