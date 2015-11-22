// Test basic usage of cli. Contains confusing setTimeouts

var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var assert = require('assert');
var utils = require('../utils');
var run = utils.run;

// If true, output of commands are shown
var DEBUG_TESTS = false;

// Arbitrary file which is created on detected changes
// Used to determine that file changes were actually detected.
var CHANGE_FILE = 'dir/change';

// Time to wait for different tasks
var TIMEOUT_WATCH_READY = 1000;
var TIMEOUT_CHANGE_DETECTED = 700;
var TIMEOUT_KILL = TIMEOUT_WATCH_READY + TIMEOUT_CHANGE_DETECTED + 1000;

// Abs path to test directory
var testDir = path.resolve(__dirname);
process.chdir(path.join(testDir, '..'));

describe('chokidar-cli', function() {
    this.timeout(5000);

    afterEach(function clean(done) {
        if (changeFileExists()) {
            fs.unlinkSync(resolve(CHANGE_FILE));
        }

        // Clear all changes in the test directory
        run('git checkout HEAD dir', {cwd: testDir})
        .then(function() {
            done();
        });
    })

    it('help should be succesful', function(done) {
        run('node index.js --help', {pipe: DEBUG_TESTS})
        .then(function(exitCode) {
            // exit code 0 means success
            assert.strictEqual(exitCode, 0);
            done();
        });
    });

    it('version should be successful', function(done) {
        run('node index.js -v', {pipe: DEBUG_TESTS})
        .then(function(exitCode) {
            // exit code 0 means success
            assert.strictEqual(exitCode, 0);
            done();
        });
    });

    it('**/*.less should detect all less files in dir tree', function(done) {
        var killed = false;

        // Use a file to detect that trigger command is actually run
        var touch = 'touch ' + CHANGE_FILE;

        // No quotes needed in glob pattern because node process spawn
        // does no globbing
        // TODO: touch command does not always create file before assertion
        run('node ../index.js "dir/**/*.less" -c "' + touch + '"', {
            pipe: DEBUG_TESTS,
            cwd: './test',
            // Called after process is spawned
            callback: function(child) {
                setTimeout(function killChild() {
                    // Kill child after test case
                    child.kill();
                    killed = true;
                }, TIMEOUT_KILL);
            }
        })
        .then(function childProcessExited(exitCode) {
            // Process should be killed after a timeout,
            // test if the process died unexpectedly before it
            assert(killed, 'process exited too quickly');
            done();
        });

        setTimeout(function afterWatchIsReady() {
            fs.writeFileSync(resolve('dir/subdir/c.less'), 'content');

            setTimeout(function() {
                assert(changeFileExists(), 'change file should exist')
            }, TIMEOUT_CHANGE_DETECTED)
        }, TIMEOUT_WATCH_READY);
    });

    it('should replace {path} and {event} in command', function(done) {
        var command = "echo '{event}:{path}' > " + CHANGE_FILE;

        setTimeout(function() {
          fs.writeFileSync(resolve('dir/a.js'), 'content');
        }, TIMEOUT_WATCH_READY);

        run('node ../index.js "dir/a.js" -c "' + command + '"', {
            pipe: DEBUG_TESTS,
            cwd: './test',
            callback: function(child) {
                setTimeout(child.kill.bind(child), TIMEOUT_KILL);
            }
        })
        .then(function() {
            var res = fs.readFileSync(resolve(CHANGE_FILE)).toString().trim();
            assert.equal(res, 'change:dir/a.js', 'need event/path detail');
            done()
        });
    });
});

function resolve(relativePath) {
    return path.join(testDir, relativePath);
}

function changeFileExists() {
    return fs.existsSync(resolve(CHANGE_FILE));
}
