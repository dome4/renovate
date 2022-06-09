"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtendsMigration = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const global_1 = require("../../global");
const common_1 = require("../../presets/common");
const abstract_migration_1 = require("../base/abstract-migration");
class ExtendsMigration extends abstract_migration_1.AbstractMigration {
    constructor() {
        super(...arguments);
        this.propertyName = 'extends';
    }
    run() {
        const value = this.get('extends');
        let newPresets = [];
        if (is_1.default.string(value)) {
            newPresets = this.normalizePresets([value]);
        }
        if (Array.isArray(value)) {
            newPresets = this.normalizePresets(value);
        }
        this.rewrite(newPresets);
    }
    normalizePresets(presets) {
        return presets
            .filter(is_1.default.string)
            .map((preset) => this.normalizePreset(preset))
            .filter(is_1.default.nonEmptyString);
    }
    normalizePreset(preset) {
        const { migratePresets } = global_1.GlobalConfig.get();
        if (common_1.removedPresets[preset] !== undefined) {
            return common_1.removedPresets[preset];
        }
        if (migratePresets?.[preset] !== undefined) {
            return migratePresets?.[preset];
        }
        return preset;
    }
}
exports.ExtendsMigration = ExtendsMigration;
//# sourceMappingURL=extends-migration.js.map