"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomergePatchMigration = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const abstract_migration_1 = require("../base/abstract-migration");
class AutomergePatchMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.deprecated = true;
        this.propertyName = 'automergePatch';
    }
    run(value) {
        const patch = this.get('patch');
        const newPatch = is_1.default.object(patch) ? patch : {};
        newPatch.automerge = Boolean(value);
        this.setHard('patch', newPatch);
    }
}
exports.AutomergePatchMigration = AutomergePatchMigration;
//# sourceMappingURL=automerge-patch-migration.js.map