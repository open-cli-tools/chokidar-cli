var Promise = require('bluebird');
var execSh = require('exec-sh');
var colors = require('colors');
var async = require('async');
var _ = require('lodash');
var colors = require('colors');

// Allow to cancel bluebird promises
Promise.config({
    cancellation: true
});

// Execute command as cancellable promise
function exec(task, finish) {
    task.promise = new Promise(function(resolve, reject, onCancel) {
        var process = execSh(task.cmd, {}, function(err, stdout, stderr) {
            // Avoid issues with killing exited process
            process = undefined;

            // No need to reject/resolve if promise was cancelled and process was killed
            if (task.promise.isCancelled()) {
                return;
            }

            if (err) {
                // Error code !== 0
                console.log(('Error code: ' + err.code + ' for run #' + task.number).red);
                reject(err, stdout, stderr);
            }
            else {
                console.log(('Finished run #' + task.number).green);
                resolve();
            }
        });

        onCancel(function () {
            console.log(('Cancelled run #' + task.number).yellow);
            if (process) {
                console.log(('Killing run #' + task.number).yellow);

                // XXX: should we send SIGKILL or account for sub-processes somehow
                // or is it really as simple as this
                process.kill();
            }
        });
    });

    task.promise.finally(function () {
        // Tell the queue that we're finished
        finish();
    });
}

// Create runner based on specified concurrency model
function runner(concurrencyModel) {
    // async.queue does not support unlimited concurrent tasks.
    // Set sane (?) default - 100 tasks for parallel mode
    var concurrency = ('parallel' === concurrencyModel) ? 100 : 1;

    // Create worker queue
    var queue = async.queue(exec, concurrency);
    var taskNumber = 1;

    var run = function (cmd) {
        // In queue mode: we don't want to queue more than one
        // extra task to be run after filesystem stops changing
        if ('queue' === concurrencyModel && queue.length()) {
            console.log(('Command is already queued, skipping').blue);

            return;
        }

        // In kill mode: cancel running task before pushing new one
        if ('kill' === concurrencyModel && queue.running()) {
            _.each(queue.workersList(), function (worker) {
                worker.data.promise.cancel();
            });
        }

        console.log(('Adding task #' + taskNumber + ' to the queue').inverse);
        queue.push({
            cmd: cmd,
            number: taskNumber++
        });
    };

    // Return new runner with run method
    return {
        run: run
    };
}

module.exports = {
    runner: runner
};
