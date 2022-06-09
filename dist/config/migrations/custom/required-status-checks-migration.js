"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequiredStatusChecksMigration = void 0;
const abstract_migration_1 = require("../base/abstract-migration");
class RequiredStatusChecksMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.deprecated = true;
        this.propertyName = 'requiredStatusChecks';
    }
    run(value) {
        if (value === null) {
            this.setSafely('ignoreTests', true);
        }
    }
}
exports.RequiredStatusChecksMigration = RequiredStatusChecksMigration;
//# sourceMappingURL=required-status-checks-migration.js.map