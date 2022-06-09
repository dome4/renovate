"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingCommitMessageFactory = void 0;
const commit_message_factory_1 = require("../../model/commit-message-factory");
class OnboardingCommitMessageFactory {
    constructor(config, configFile) {
        this.config = config;
        this.configFile = configFile;
    }
    create() {
        const { onboardingCommitMessage } = this.config;
        const commitMessageFactory = new commit_message_factory_1.CommitMessageFactory(this.config);
        const commitMessage = commitMessageFactory.create();
        if (onboardingCommitMessage) {
            commitMessage.subject = onboardingCommitMessage;
        }
        else {
            commitMessage.subject = `add ${this.configFile}`;
        }
        return commitMessage;
    }
}
exports.OnboardingCommitMessageFactory = OnboardingCommitMessageFactory;
//# sourceMappingURL=commit-message.js.map