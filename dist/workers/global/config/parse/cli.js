"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = exports.getCliName = void 0;
const tslib_1 = require("tslib");
const commander_1 = require("commander");
const json5_1 = tslib_1.__importDefault(require("json5"));
const options_1 = require("../../../../config/options");
const expose_cjs_1 = require("../../../../expose.cjs");
const logger_1 = require("../../../../logger");
const regex_1 = require("../../../../util/regex");
function getCliName(option) {
    if (option.cli === false) {
        return '';
    }
    const nameWithHyphens = option.name.replace((0, regex_1.regEx)(/([A-Z])/g), '-$1');
    return `--${nameWithHyphens.toLowerCase()}`;
}
exports.getCliName = getCliName;
function getConfig(input) {
    // massage migrated configuration keys
    const argv = input
        .map((a) => a
        .replace('--endpoints=', '--host-rules=')
        .replace('--expose-env=true', '--trust-level=high')
        .replace('--expose-env', '--trust-level=high')
        .replace('--renovate-fork', '--include-forks')
        .replace('"platform":"', '"hostType":"')
        .replace('"endpoint":"', '"matchHost":"')
        .replace('"host":"', '"matchHost":"')
        .replace('--azure-auto-complete', '--platform-automerge') // migrate: azureAutoComplete
        .replace('--git-lab-automerge', '--platform-automerge') // migrate: gitLabAutomerge
        .replace(/^--dry-run$/, '--dry-run=true')
        .replace(/^--require-config$/, '--require-config=true'))
        .filter((a) => !a.startsWith('--git-fs'));
    const options = (0, options_1.getOptions)();
    const config = {};
    const coersions = {
        boolean: (val) => {
            if (val === 'true' || val === '') {
                return true;
            }
            if (val === 'false') {
                return false;
            }
            throw new Error("Invalid boolean value: expected 'true' or 'false', but got '" +
                val +
                "'");
        },
        array: (val) => {
            if (val === '') {
                return [];
            }
            try {
                return json5_1.default.parse(val);
            }
            catch (err) {
                return val.split(',').map((el) => el.trim());
            }
        },
        object: (val) => {
            if (val === '') {
                return {};
            }
            try {
                return json5_1.default.parse(val);
            }
            catch (err) {
                throw new Error("Invalid JSON value: '" + val + "'");
            }
        },
        string: (val) => val,
        integer: parseInt,
    };
    let program = new commander_1.Command().arguments('[repositories...]');
    options.forEach((option) => {
        if (option.cli !== false) {
            const param = `<${option.type}>`.replace('<boolean>', '[boolean]');
            const optionString = `${getCliName(option)} ${param}`;
            program = program.option(optionString, option.description, coersions[option.type]);
        }
    });
    /* eslint-disable no-console */
    /* istanbul ignore next */
    function helpConsole() {
        console.log('  Examples:');
        console.log('');
        console.log('    $ renovate --token 123test singapore/lint-condo');
        console.log('    $ LOG_LEVEL=debug renovate --labels=renovate,dependency --ignore-unstable=false singapore/lint-condo');
        console.log('    $ renovate singapore/lint-condo singapore/package-test');
        console.log(`    $ renovate singapore/lint-condo --onboarding-config='{"extends":["config:base"]}'`);
        /* eslint-enable no-console */
    }
    program = program
        .version(expose_cjs_1.pkg.version, '-v, --version')
        .on('--help', helpConsole)
        .action((repositories, opts) => {
        if (repositories?.length) {
            config.repositories = repositories;
        }
        for (const option of options) {
            if (option.cli !== false) {
                if (opts[option.name] !== undefined) {
                    config[option.name] = opts[option.name];
                    if (option.name === 'dryRun') {
                        if (config[option.name] === 'true') {
                            logger_1.logger.warn('cli config dryRun property has been changed to full');
                            config[option.name] = 'full';
                        }
                        else if (config[option.name] === 'false') {
                            logger_1.logger.warn('cli config dryRun property has been changed to null');
                            config[option.name] = null;
                        }
                        else if (config[option.name] === 'null') {
                            config[option.name] = null;
                        }
                    }
                    if (option.name === 'requireConfig') {
                        if (config[option.name] === 'true') {
                            logger_1.logger.warn('cli config requireConfig property has been changed to required');
                            config[option.name] = 'required';
                        }
                        else if (config[option.name] === 'false') {
                            logger_1.logger.warn('cli config requireConfig property has been changed to optional');
                            config[option.name] = 'optional';
                        }
                    }
                }
            }
        }
    })
        .parse(argv);
    return config;
}
exports.getConfig = getConfig;
//# sourceMappingURL=cli.js.map