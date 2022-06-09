"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureGitLabAutomergeMigration = void 0;
const abstract_migration_1 = require("../base/abstract-migration");
class AzureGitLabAutomergeMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.deprecated = true;
        this.propertyName = /^azureAutoComplete$|^gitLabAutomerge$/;
    }
    run(value) {
        if (value !== undefined) {
            this.setHard('platformAutomerge', value);
        }
    }
}
exports.AzureGitLabAutomergeMigration = AzureGitLabAutomergeMigration;
//# sourceMappingURL=azure-gitlab-automerge-migration.js.map