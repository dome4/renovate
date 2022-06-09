"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RebaseStalePrsMigration = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const abstract_migration_1 = require("../base/abstract-migration");
class RebaseStalePrsMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.deprecated = true;
        this.propertyName = 'rebaseStalePrs';
    }
    run(value) {
        const rebaseConflictedPrs = this.get('rebaseConflictedPrs');
        if (rebaseConflictedPrs !== false) {
            if (is_1.default.boolean(value)) {
                this.setSafely('rebaseWhen', value ? 'behind-base-branch' : 'conflicted');
            }
            if (is_1.default.null_(value)) {
                this.setSafely('rebaseWhen', 'auto');
            }
        }
    }
}
exports.RebaseStalePrsMigration = RebaseStalePrsMigration;
//# sourceMappingURL=rebase-stale-prs-migration.js.map