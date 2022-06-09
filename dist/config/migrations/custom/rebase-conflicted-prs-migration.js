"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RebaseConflictedPrs = void 0;
const abstract_migration_1 = require("../base/abstract-migration");
class RebaseConflictedPrs extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.deprecated = true;
        this.propertyName = 'rebaseConflictedPrs';
    }
    run(value) {
        if (value === false) {
            this.setSafely('rebaseWhen', 'never');
        }
    }
}
exports.RebaseConflictedPrs = RebaseConflictedPrs;
//# sourceMappingURL=rebase-conflicted-prs-migration.js.map