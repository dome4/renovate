"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PinVersionsMigration = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const abstract_migration_1 = require("../base/abstract-migration");
class PinVersionsMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.deprecated = true;
        this.propertyName = 'pinVersions';
    }
    run(value) {
        if (is_1.default.boolean(value)) {
            this.setSafely('rangeStrategy', value ? 'pin' : 'replace');
        }
    }
}
exports.PinVersionsMigration = PinVersionsMigration;
//# sourceMappingURL=pin-versions-migration.js.map