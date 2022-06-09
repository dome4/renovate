"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomergeMigration = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const abstract_migration_1 = require("../base/abstract-migration");
class AutomergeMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.propertyName = 'automerge';
    }
    run(value) {
        const patch = this.get('patch');
        const minor = this.get('minor');
        const major = this.get('major');
        const newPatch = is_1.default.object(patch) ? patch : {};
        const newMinor = is_1.default.object(minor) ? minor : {};
        const newMajor = is_1.default.object(major) ? major : {};
        switch (value) {
            case 'none':
                this.rewrite(false);
                break;
            case 'patch':
                this.delete();
                newPatch.automerge = true;
                newMinor.automerge = false;
                newMajor.automerge = false;
                this.setHard('patch', newPatch);
                this.setHard('minor', newMinor);
                this.setHard('major', newMajor);
                break;
            case 'minor':
                this.delete();
                newMinor.automerge = true;
                newMajor.automerge = false;
                this.setHard('minor', newMinor);
                this.setHard('major', newMajor);
                break;
            case 'any':
                this.rewrite(true);
        }
    }
}
exports.AutomergeMigration = AutomergeMigration;
//# sourceMappingURL=automerge-migration.js.map