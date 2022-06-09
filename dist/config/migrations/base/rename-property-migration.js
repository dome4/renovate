"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenamePropertyMigration = void 0;
const abstract_migration_1 = require("./abstract-migration");
class RenamePropertyMigration extends abstract_migration_1.AbstractMigration {
    constructor(deprecatedPropertyName, newPropertyName, originalConfig, migratedConfig) {
        super(originalConfig, migratedConfig);
        this.deprecated = true;
        this.propertyName = deprecatedPropertyName;
        this.newPropertyName = newPropertyName;
    }
    run(value) {
        this.setSafely(this.newPropertyName, value);
    }
}
exports.RenamePropertyMigration = RenamePropertyMigration;
//# sourceMappingURL=rename-property-migration.js.map