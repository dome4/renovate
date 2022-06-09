"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applySecretsToConfig = exports.validateConfigSecrets = void 0;
const tslib_1 = require("tslib");
const is_1 = tslib_1.__importDefault(require("@sindresorhus/is"));
const error_messages_1 = require("../constants/error-messages");
const logger_1 = require("../logger");
const regex_1 = require("../util/regex");
const sanitize_1 = require("../util/sanitize");
const secretNamePattern = '[A-Za-z][A-Za-z0-9_]*';
const secretNameRegex = (0, regex_1.regEx)(`^${secretNamePattern}$`);
const secretTemplateRegex = (0, regex_1.regEx)(`{{ secrets\\.(${secretNamePattern}) }}`);
function validateSecrets(secrets_) {
    if (!secrets_) {
        return;
    }
    const validationErrors = [];
    if (is_1.default.plainObject(secrets_)) {
        for (const [secretName, secretValue] of Object.entries(secrets_)) {
            if (!secretNameRegex.test(secretName)) {
                validationErrors.push(`Invalid secret name "${secretName}"`);
            }
            if (!is_1.default.string(secretValue)) {
                validationErrors.push(`Secret values must be strings. Found type ${typeof secretValue} for secret ${secretName}`);
            }
        }
    }
    else {
        validationErrors.push(`Config secrets must be a plain object. Found: ${typeof secrets_}`);
    }
    if (validationErrors.length) {
        logger_1.logger.error({ validationErrors }, 'Invalid secrets configured');
        throw new Error(error_messages_1.CONFIG_SECRETS_INVALID);
    }
}
function validateConfigSecrets(config) {
    validateSecrets(config.secrets);
    if (config.repositories) {
        for (const repository of config.repositories) {
            if (is_1.default.plainObject(repository)) {
                validateSecrets(repository.secrets);
            }
        }
    }
}
exports.validateConfigSecrets = validateConfigSecrets;
function replaceSecretsInString(key, value, secrets) {
    // do nothing if no secret template found
    if (!secretTemplateRegex.test(value)) {
        return value;
    }
    const disallowedPrefixes = ['branch', 'commit', 'group', 'pr', 'semantic'];
    if (disallowedPrefixes.some((prefix) => key.startsWith(prefix))) {
        const error = new Error(error_messages_1.CONFIG_VALIDATION);
        error.validationSource = 'config';
        error.validationError = 'Disallowed secret substitution';
        error.validationMessage = `The field ${key} may not use secret substitution`;
        throw error;
    }
    return value.replace(secretTemplateRegex, (_, secretName) => {
        if (secrets?.[secretName]) {
            return secrets[secretName];
        }
        const error = new Error(error_messages_1.CONFIG_VALIDATION);
        error.validationSource = 'config';
        error.validationError = 'Unknown secret name';
        error.validationMessage = `The following secret name was not found in config: ${String(secretName)}`;
        throw error;
    });
}
function replaceSecretsInObject(config_, secrets, deleteSecrets) {
    const config = { ...config_ };
    if (deleteSecrets) {
        delete config.secrets;
    }
    for (const [key, value] of Object.entries(config)) {
        if (is_1.default.plainObject(value)) {
            config[key] = replaceSecretsInObject(value, secrets, deleteSecrets);
        }
        if (is_1.default.string(value)) {
            config[key] = replaceSecretsInString(key, value, secrets);
        }
        if (is_1.default.array(value)) {
            for (const [arrayIndex, arrayItem] of value.entries()) {
                if (is_1.default.plainObject(arrayItem)) {
                    value[arrayIndex] = replaceSecretsInObject(arrayItem, secrets, deleteSecrets);
                }
                else if (is_1.default.string(arrayItem)) {
                    value[arrayIndex] = replaceSecretsInString(key, arrayItem, secrets);
                }
            }
        }
    }
    return config;
}
function applySecretsToConfig(config, secrets = config.secrets, deleteSecrets = true) {
    // Add all secrets to be sanitized
    if (is_1.default.plainObject(secrets)) {
        for (const secret of Object.values(secrets)) {
            (0, sanitize_1.addSecretForSanitizing)(String(secret));
        }
    }
    // TODO: fix types (#9610)
    return replaceSecretsInObject(config, secrets, deleteSecrets);
}
exports.applySecretsToConfig = applySecretsToConfig;
//# sourceMappingURL=secrets.js.map