'use strict';

const {spawn} = require('child_process');

// XXX: Wrapping tos to a promise is a bit wrong abstraction. Maybe RX suits
// better?
function run(cmd, opts) {
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
            child = spawn(cmd, {
                cwd: opts.cwd,
                shell: true,
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
