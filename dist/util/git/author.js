"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGitAuthor = void 0;
const tslib_1 = require("tslib");
const email_addresses_1 = tslib_1.__importDefault(require("email-addresses"));
const logger_1 = require("../../logger");
const regex_1 = require("../regex");
function parseGitAuthor(input) {
    let result = null;
    if (!input) {
        return null;
    }
    try {
        result = email_addresses_1.default.parseOneAddress(input);
        if (result) {
            return result;
        }
        let massagedInput;
        let massagedBotEmail = false;
        if (input.includes('<') && input.includes('>')) {
            // try wrapping the name part in quotations
            massagedInput = '"' + input.replace((0, regex_1.regEx)(/(\s?<)/), '"$1');
        }
        if (input.includes('[bot]@')) {
            // invalid github app/bot addresses
            massagedInput = (massagedInput ?? input).replace('[bot]@', '@');
            massagedBotEmail = true;
        }
        if (!massagedInput) {
            return null;
        }
        const parsed = email_addresses_1.default.parseOneAddress(massagedInput);
        if (parsed?.address) {
            result = {
                name: parsed.name ?? input.replace((0, regex_1.regEx)(/@.*/), ''),
                address: parsed.address,
            };
            if (massagedBotEmail) {
                result.address = result.address?.replace('@', '[bot]@');
            }
            return result;
        }
    }
    catch (err) /* istanbul ignore next */ {
        logger_1.logger.debug({ err }, 'Unknown error parsing gitAuthor');
    }
    // give up
    return null;
}
exports.parseGitAuthor = parseGitAuthor;
//# sourceMappingURL=author.js.map