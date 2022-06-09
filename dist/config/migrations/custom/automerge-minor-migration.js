"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomergeMinorMigration = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const abstract_migration_1 = require("../base/abstract-migration");
class AutomergeMinorMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.deprecated = true;
        this.propertyName = 'automergeMinor';
    }
    run(value) {
        const minor = this.get('minor');
        const newMinor = is_1.default.object(minor) ? minor : {};
        newMinor.automerge = Boolean(value);
        this.setHard('minor', newMinor);
    }
}
exports.AutomergeMinorMigration = AutomergeMinorMigration;
//# sourceMappingURL=automerge-minor-migration.js.map