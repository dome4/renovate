"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeparateMultipleMajorMigration = void 0;
const abstract_migration_1 = require("../base/abstract-migration");
class SeparateMultipleMajorMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.propertyName = 'separateMultipleMajor';
    }
    run() {
        if (this.has('separateMajorReleases')) {
            this.delete();
        }
    }
}
exports.SeparateMultipleMajorMigration = SeparateMultipleMajorMigration;
//# sourceMappingURL=separate-multiple-major-migration.js.map