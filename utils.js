var childProcess = require('child_process');
var _ = require('lodash');
var Promise = require('bluebird');

function run(cmd, opts) {
    opts = _.merge({
        pipe: true,
        cwd: undefined,
        callback: function(child) {
            // Since we return promise, we need to provide
            // this callback if one wants to access the child
            // process reference
            // Called immediately after successful child process
            // spawn
        }
    }, opts);

    var child;
    var parts = cmd.split(' ');
    try {
        child = childProcess.spawn(_.head(parts), _.tail(parts), {
            cwd: opts.cwd
        });
    } catch (e) {
        return Promise.reject(e);
    }
    opts.callback(child);

    // TODO: Is there a chance of locking/waiting forever?
    if (opts.pipe) {
        child.stdin.pipe(process.stdin);
        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);
    }

    return new Promise(function(resolve, reject) {
        child.on('error', function(err) {
            reject(err);
        });

        child.on('close', function(exitCode) {
            resolve(exitCode);
        });
    });
}

module.exports = {
    run: run
};
