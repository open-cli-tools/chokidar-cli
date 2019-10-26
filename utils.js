'use strict';

const {spawn} = require('child_process');

// Try to resolve path to shell.
// We assume that Windows provides COMSPEC env variable
// and other platforms provide SHELL env variable
const SHELL_PATH = process.env.SHELL || process.env.COMSPEC;
const EXECUTE_OPTION = process.env.COMSPEC !== undefined && process.env.SHELL === undefined ? '/c' : '-c';

// XXX: Wrapping tos to a promise is a bit wrong abstraction. Maybe RX suits
// better?
function run(cmd, opts) {
    if (!SHELL_PATH) {
        // If we cannot resolve shell, better to just crash
        throw new Error('$SHELL environment variable is not set.');
    }

    opts = {
        pipe: true,
        cwd: undefined,
        callback(child) { // eslint-disable-line no-unused-vars
            // Since we return promise, we need to provide
            // this callback if one wants to access the child
            // process reference
            // Called immediately after successful child process
            // spawn
        }, ...opts};

    return new Promise((resolve, reject) => {
        let child;

        try {
            child = spawn(SHELL_PATH, [EXECUTE_OPTION, cmd], {
                cwd: opts.cwd,
                stdio: opts.pipe ? 'inherit' : null
            });
        } catch (error) {
            return reject(error);
        }

        opts.callback(child);

        function errorHandler(err) {
            child.removeListener('close', closeHandler);
            reject(err);
        }

        function closeHandler(exitCode) {
            child.removeListener('error', errorHandler);
            resolve(exitCode);
        }

        child.once('error', errorHandler);
        child.once('close', closeHandler);
    });
}

module.exports = {
    run
};
