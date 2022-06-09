"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageNameMigration = void 0;
const abstract_migration_1 = require("../base/abstract-migration");
class PackageNameMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.deprecated = true;
        this.propertyName = 'packageName';
    }
    run(value) {
        this.setSafely('packageNames', [value]);
    }
}
exports.PackageNameMigration = PackageNameMigration;
//# sourceMappingURL=package-name-migration.js.map