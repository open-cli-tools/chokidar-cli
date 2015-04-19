// Test basic usage of cli. Contains a bit confusing setTimeouts

var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var assert = require('assert');
var utils = require('../utils');
var run = utils.run;


var DEBUG_TESTS = true;

// Arbitrary file which is created on detected changes
// Used to determine that file changes were actually detected.
var CHANGE_FILE = 'change';

// Abs path to test directory
var testDir = path.resolve(__dirname);

describe('chokidar-cli', function() {
    afterEach(function clean() {
        if (changeFileExists()) {
            fs.unlinkSync(resolve(CHANGE_FILE));
        }
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
        var touch = 'touch ' + CHANGE_FILE
        run('node ../../index.js "**/*.less" "' + touch + '"', {
            pipe: DEBUG_TESTS,
            cwd: './test/dir',
            callback: function(child) {
                setTimeout(function() {
                    child.kill();
                    killed = true;
                }, 1000);
            }
        })
        .then(function(exitCode) {
            // Process should be killed after a timeout,
            // test if the process died unexpectedly before it
            assert(killed, 'process exited too quickly');
            done();
        });

        fs.writeFileSync(resolve('dir/a.less'), 'content');
        setTimeout(function() {
            assert(changeFileExists(), 'change file should exist')
        }, 800)
    });
});

function resolve(relativePath) {
    return path.join(testDir, relativePath);
}

function changeFileExists() {
    return fs.existsSync(resolve(CHANGE_FILE));
}
