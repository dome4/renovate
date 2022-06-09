"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnpublishSafeMigration = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const abstract_migration_1 = require("../base/abstract-migration");
class UnpublishSafeMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.deprecated = true;
        this.propertyName = 'unpublishSafe';
    }
    run(value) {
        const extendsValue = this.get('extends');
        const newExtendsValue = Array.isArray(extendsValue) ? extendsValue : [];
        if (value === true) {
            if (is_1.default.string(extendsValue)) {
                newExtendsValue.push(extendsValue);
            }
            if (newExtendsValue.every((item) => !this.isSupportedValue(item))) {
                newExtendsValue.push('npm:unpublishSafe');
            }
            this.setHard('extends', newExtendsValue.map((item) => {
                if (this.isSupportedValue(item)) {
                    return 'npm:unpublishSafe';
                }
                return item;
            }));
        }
    }
    isSupportedValue(value) {
        return UnpublishSafeMigration.SUPPORTED_VALUES.includes(value);
    }
}
exports.UnpublishSafeMigration = UnpublishSafeMigration;
UnpublishSafeMigration.SUPPORTED_VALUES = [
    ':unpublishSafe',
    'default:unpublishSafe',
    'npm:unpublishSafe',
];
//# sourceMappingURL=unpublish-safe-migration.js.map