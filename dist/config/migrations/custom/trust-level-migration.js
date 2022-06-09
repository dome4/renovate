"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrustLevelMigration = void 0;
const abstract_migration_1 = require("../base/abstract-migration");
class TrustLevelMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.deprecated = true;
        this.propertyName = 'trustLevel';
    }
    run(value) {
        if (value === 'high') {
            this.setSafely('allowCustomCrateRegistries', true);
            this.setSafely('allowScripts', true);
            this.setSafely('exposeAllEnv', true);
        }
    }
}
exports.TrustLevelMigration = TrustLevelMigration;
//# sourceMappingURL=trust-level-migration.js.map