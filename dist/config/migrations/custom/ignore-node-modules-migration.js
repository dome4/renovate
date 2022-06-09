"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IgnoreNodeModulesMigration = void 0;
const abstract_migration_1 = require("../base/abstract-migration");
class IgnoreNodeModulesMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.deprecated = true;
        this.propertyName = 'ignoreNodeModules';
    }
    run(value) {
        this.setSafely('ignorePaths', value ? ['node_modules/'] : []);
    }
}
exports.IgnoreNodeModulesMigration = IgnoreNodeModulesMigration;
//# sourceMappingURL=ignore-node-modules-migration.js.map