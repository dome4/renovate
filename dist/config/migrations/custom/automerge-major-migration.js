"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomergeMajorMigration = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const abstract_migration_1 = require("../base/abstract-migration");
class AutomergeMajorMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.deprecated = true;
        this.propertyName = 'automergeMajor';
    }
    run(value) {
        const major = this.get('major');
        const newMajor = is_1.default.object(major) ? major : {};
        newMajor.automerge = Boolean(value);
        this.setHard('major', newMajor);
    }
}
exports.AutomergeMajorMigration = AutomergeMajorMigration;
//# sourceMappingURL=automerge-major-migration.js.map