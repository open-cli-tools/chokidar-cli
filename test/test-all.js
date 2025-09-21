// Test basic usage of cli. Contains confusing setTimeouts

/* eslint-env mocha */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {run} = require('../utils');

// If true, output of commands are shown
const DEBUG_TESTS = false;

// Arbitrary file which is created on detected changes
// Used to determine that file changes were actually detected.
const CHANGE_FILE = 'dir/change';

// Time to wait for different tasks
// TODO: These lead to flakiness and might require the eventual bump to get tests passing.
const TIMEOUT_WATCH_READY = 1000;
const TIMEOUT_CHANGE_DETECTED = 1000;
const TIMEOUT_KILL = TIMEOUT_WATCH_READY + TIMEOUT_CHANGE_DETECTED + 1000;

// Abs path to test directory
const testDir = path.resolve(__dirname);
process.chdir(path.join(testDir, '..'));

describe('chokidar-cli', function() {
    this.timeout(5000);

    afterEach(function clean(done) {
        if (changeFileExists()) {
            fs.unlinkSync(resolve(CHANGE_FILE));
        }

        // Clear all changes in the test directory
        run('git checkout HEAD dir', {cwd: testDir})
            .then(() => {
                done();
            });
    });

    it('help should be succesful', done => {
        run('node index.js --help', {pipe: DEBUG_TESTS})
            .then(exitCode => {
                // exit code 0 means success
                assert.strictEqual(exitCode, 0);
                done();
            });
    });

    it('version should be successful', done => {
        run('node index.js -v', {pipe: DEBUG_TESTS})
            .then(exitCode => {
                // exit code 0 means success
                assert.strictEqual(exitCode, 0);
                done();
            });
    });

    it('**/*.less should detect all less files in dir tree', done => {
        let killed = false;

        // Use a file to detect that trigger command is actually run
        const touch = `touch ${CHANGE_FILE}`;

        // No quotes needed in glob pattern because node process spawn
        // does no globbing
        // TODO: touch command does not always create file before assertion
        run(`node ../index.js "dir/**/*.less" -c "${touch}"`, {
            pipe: DEBUG_TESTS,
            cwd: './test',
            // Called after process is spawned
            callback(child) {
                setTimeout(function killChild() {
                    // Kill child after test case
                    child.kill();
                    killed = true;
                }, TIMEOUT_KILL);
            }
        })
            .then(function childProcessExited() {
                // Process should be killed after a timeout,
                // test if the process died unexpectedly before it
                assert(killed, 'process exited too quickly');
                done();
            });

        setTimeout(function afterWatchIsReady() {
            fs.writeFileSync(resolve('dir/subdir/c.less'), 'content');

            setTimeout(() => {
                assert(changeFileExists(), 'change file should exist');
            }, TIMEOUT_CHANGE_DETECTED);
        }, TIMEOUT_WATCH_READY);
    });

    it('should replace {path} and {event} in command', done => {
        const command = `echo '{event}:{path}' > ${CHANGE_FILE}`;

        setTimeout(() => {
            fs.writeFileSync(resolve('dir/a.js'), 'content');
        }, TIMEOUT_WATCH_READY);

        run(`node ../index.js "dir/a.js" -c "${command}"`, {
            pipe: DEBUG_TESTS,
            cwd: './test',
            callback(child) {
                setTimeout(child.kill.bind(child), TIMEOUT_KILL);
            }
        })
            .then(() => {
                const res = fs.readFileSync(resolve(CHANGE_FILE)).toString().trim();
                assert.strictEqual(res, 'change:dir/a.js', 'need event/path detail');
                done();
            });
    });
});

function resolve(relativePath) {
    return path.join(testDir, relativePath);
}

function changeFileExists() {
    return fs.existsSync(resolve(CHANGE_FILE));
}
