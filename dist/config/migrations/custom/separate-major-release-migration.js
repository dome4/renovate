"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeparateMajorReleasesMigration = void 0;
const abstract_migration_1 = require("../base/abstract-migration");
class SeparateMajorReleasesMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.propertyName = 'separateMajorReleases';
    }
    run(value) {
        this.setSafely('separateMajorMinor', value);
    }
}
exports.SeparateMajorReleasesMigration = SeparateMajorReleasesMigration;
//# sourceMappingURL=separate-major-release-migration.js.map