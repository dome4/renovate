"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nameMatchRegex = exports.galaxyRegEx = exports.dependencyRegex = exports.galaxyDepRegex = exports.blockLineRegEx = exports.newBlockRegEx = void 0;
const regex_1 = require("../../../util/regex");
exports.newBlockRegEx = /^\s*-\s*((\w+):\s*(.*))$/;
exports.blockLineRegEx = /^\s*((\w+):\s*(.*))$/;
exports.galaxyDepRegex = /[\w-]+\.[\w-]+/;
exports.dependencyRegex = /^dependencies:/;
exports.galaxyRegEx = (0, regex_1.regEx)(/^\s+(?<packageName>[\w.]+):\s*["'](?<version>.+)["']\s*/);
exports.nameMatchRegex = (0, regex_1.regEx)(/(?<source>((git\+)?(?:(git|ssh|https?):\/\/)?(.*@)?(?<hostname>[\w.-]+)(?:(:\d+)?\/|:))(?<depName>[\w./-]+)(?:\.git)?)(,(?<version>[\w.]*))?/);
//# sourceMappingURL=util.js.map