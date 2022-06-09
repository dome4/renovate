"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DryRunMigration = void 0;
const abstract_migration_1 = require("../base/abstract-migration");
class DryRunMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.propertyName = 'dryRun';
    }
    run(value) {
        if (value === true) {
            this.rewrite('full');
        }
        if (value === false) {
            this.rewrite(null);
        }
    }
}
exports.DryRunMigration = DryRunMigration;
//# sourceMappingURL=dry-run-migration.js.map