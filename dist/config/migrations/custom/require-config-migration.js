"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequireConfigMigration = void 0;
const abstract_migration_1 = require("../base/abstract-migration");
class RequireConfigMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.propertyName = 'requireConfig';
    }
    run(value) {
        if (value === false || value === 'false') {
            this.rewrite('optional');
        }
        else if (value === true || value === 'true') {
            this.rewrite('required');
        }
    }
}
exports.RequireConfigMigration = RequireConfigMigration;
//# sourceMappingURL=require-config-migration.js.map