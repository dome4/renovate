"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinarySourceMigration = void 0;
const abstract_migration_1 = require("../base/abstract-migration");
class BinarySourceMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.propertyName = 'binarySource';
    }
    run(value) {
        if (value === 'auto') {
            this.rewrite('global');
        }
    }
}
exports.BinarySourceMigration = BinarySourceMigration;
//# sourceMappingURL=binary-source-migration.js.map