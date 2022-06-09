"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemovePropertyMigration = void 0;
const abstract_migration_1 = require("./abstract-migration");
class RemovePropertyMigration extends abstract_migration_1.AbstractMigration {
    constructor(propertyName, originalConfig, migratedConfig) {
        super(originalConfig, migratedConfig);
        this.propertyName = propertyName;
    }
    run() {
        this.delete(this.propertyName);
    }
}
exports.RemovePropertyMigration = RemovePropertyMigration;
//# sourceMappingURL=remove-property-migration.js.map