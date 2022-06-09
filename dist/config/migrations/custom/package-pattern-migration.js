"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackagePatternMigration = void 0;
const abstract_migration_1 = require("../base/abstract-migration");
class PackagePatternMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.deprecated = true;
        this.propertyName = 'packagePattern';
    }
    run(value) {
        this.setSafely('packagePatterns', [value]);
    }
}
exports.PackagePatternMigration = PackagePatternMigration;
//# sourceMappingURL=package-pattern-migration.js.map