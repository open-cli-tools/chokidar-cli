#!/usr/bin/env node

var Promise = require('bluebird');
var _ = require('lodash');
var chokidar = require('chokidar');
var spawn = require('npm-run-all/lib/spawn').default;

var EVENT_DESCRIPTIONS = {
    add: 'File added',
    addDir: 'Directory added',
    unlink: 'File removed',
    unlinkDir: 'Directory removed',
    change: 'File changed'
};

// Try to resolve path to shell.
// We assume that Windows provides COMSPEC env variable
// and other platforms provide SHELL env variable
var SHELL_PATH = process.env.SHELL || process.env.COMSPEC;
var EXECUTE_OPTION = process.env.COMSPEC !== undefined && process.env.SHELL === undefined ? '/c' : '-c';

var defaultOpts = {
    debounce: 400,
    throttle: 0,
    followSymlinks: false,
    ignore: null,
    polling: false,
    pollInterval: 100,
    pollIntervalBinary: 300,
    verbose: false,
    silent: false,
    initial: false,
    command: null,
    concurrent: false
};

var VERSION = 'chokidar-cli: ' + require('./package.json').version +
              '\nchokidar: ' + require('chokidar/package').version;

var argv = require('yargs')
    .usage(
        'Usage: chokidar <pattern> [<pattern>...] [options]\n\n' +
        '<pattern>:\n' +
        'Glob pattern to specify files to be watched.\n' +
        'Multiple patterns can be watched by separating patterns with spaces.\n' +
        'To prevent shell globbing, write pattern inside quotes.\n' +
        'Guide to globs: https://github.com/isaacs/node-glob#glob-primer\n'
    )
    .example('chokidar "**/*.js" -c "npm run build-js"', 'build when any .js file changes')
    .example('chokidar "**/*.js" "**/*.less"', 'output changes of .js and .less files')
    .demand(1)
    .option('c', {
        alias: 'command',
        describe: 'Command to run after each change. ' +
                  'Needs to be surrounded with quotes when command contains ' +
                  'spaces. Instances of `{path}` or `{event}` within the ' +
                  'command will be replaced by the corresponding values from ' +
                  'the chokidar event.'
    })
    .option('d', {
        alias: 'debounce',
        default: defaultOpts.debounce,
        describe: 'Debounce timeout in ms for executing command',
        type: 'number'
    })
    .option('t', {
        alias: 'throttle',
        default: defaultOpts.throttle,
        describe: 'Throttle timeout in ms for executing command',
        type: 'number'
    })
    .option('s', {
        alias: 'follow-symlinks',
        default: defaultOpts.followSymlinks,
        describe: 'When not set, only the symlinks themselves will be watched ' +
                  'for changes instead of following the link references and ' +
                  'bubbling events through the links path',
        type: 'boolean'
    })
    .option('i', {
        alias: 'ignore',
        describe: 'Pattern for files which should be ignored. ' +
                  'Needs to be surrounded with quotes to prevent shell globbing. ' +
                  'The whole relative or absolute path is tested, not just filename. ' +
                  'Supports glob patters or regexes using format: /yourmatch/i'
    })
    .option('initial', {
        describe: 'When set, command is initially run once',
        default: defaultOpts.initial,
        type: 'boolean'
    })
    .option('concurrent', {
        describe: 'When set, command is not killed before invoking again',
        default: defaultOpts.concurrent,
        type: 'boolean'
    })
    .option('p', {
        alias: 'polling',
        describe: 'Whether to use fs.watchFile(backed by polling) instead of ' +
                  'fs.watch. This might lead to high CPU utilization. ' +
                  'It is typically necessary to set this to true to ' +
                  'successfully watch files over a network, and it may be ' +
                  'necessary to successfully watch files in other ' +
                  'non-standard situations',
        default: defaultOpts.polling,
        type: 'boolean'
    })
    .option('poll-interval', {
        describe: 'Interval of file system polling. Effective when --polling ' +
                  'is set',
        default: defaultOpts.pollInterval,
        type: 'number'
    })
    .option('poll-interval-binary', {
        describe: 'Interval of file system polling for binary files. ' +
                  'Effective when --polling is set',
        default: defaultOpts.pollIntervalBinary,
        type: 'number'
    })
    .option('verbose', {
        describe: 'When set, output is more verbose and human readable.',
        default: defaultOpts.verbose,
        type: 'boolean'
    })
    .option('silent', {
        describe: 'When set, internal messages of chokidar-cli won\'t be written.',
        default: defaultOpts.silent,
        type: 'boolean'
    })
    .help('h')
    .alias('h', 'help')
    .alias('v', 'version')
    .version(VERSION)
    .argv;


function main() {
    var userOpts = getUserOpts(argv);
    var opts = _.merge(defaultOpts, userOpts);
    startWatching(opts);
}

function getUserOpts(argv) {
    argv.patterns = argv._;
    return argv;
}

function startWatching(opts) {
    var child;
    var chokidarOpts = createChokidarOpts(opts);
    var watcher = chokidar.watch(opts.patterns, chokidarOpts);
    var execFn = _.debounce(_.throttle(function(event, path) {
        if (child) child.removeAllListeners();
        child = spawn(SHELL_PATH, [
            EXECUTE_OPTION,
            opts.command.replace(/\{path\}/ig, path).replace(/\{event\}/ig, event)
        ], {
            stdio: 'inherit'
        });
        child.once('error', function(error) { throw error; });
        child.once('exit', function() { child = undefined; });
    }, opts.throttle), opts.debounce);

    watcher.on('all', function(event, path) {
        var description = EVENT_DESCRIPTIONS[event] + ':';
        var executeCommand = _.partial(execFn, event, path);

        if (opts.verbose) {
            console.error(description, path);
        } else {
            if (!opts.silent) {
                console.log(event + ':' + path);
            }
        }

        if (opts.command) {
            // If a previous run of command created a child, and the concurrent option is not set,
            // then we should kill that child process before running it again
            if (child && !opts.concurrent) {
                child.once('exit', executeCommand);
                child.kill();
            } else {
                setImmediate(executeCommand);
            }
        }
    });

    watcher.on('error', function(error) {
        console.error('Error:', error);
        console.error(error.stack);
    });

    watcher.once('ready', function() {
        var list = opts.patterns.join('", "');
        if (!opts.silent) {
            console.error('Watching', '"' + list + '" ..');
        }
    });
}

function createChokidarOpts(opts) {
    // Transform e.g. regex ignores to real regex objects
    opts.ignore = _resolveIgnoreOpt(opts.ignore);

    var chokidarOpts = {
        followSymlinks: opts.followSymlinks,
        usePolling: opts.polling,
        interval: opts.pollInterval,
        binaryInterval: opts.pollIntervalBinary,
        ignoreInitial: !opts.initial
    };
    if (opts.ignore) chokidarOpts.ignored = opts.ignore;

    return chokidarOpts;
}

// Takes string or array of strings
function _resolveIgnoreOpt(ignoreOpt) {
    if (!ignoreOpt) {
        return ignoreOpt;
    }

    var ignores = !_.isArray(ignoreOpt) ? [ignoreOpt] : ignoreOpt;

    return _.map(ignores, function(ignore) {
        var isRegex = ignore[0] === '/' && ignore[ignore.length - 1] === '/';
        if (isRegex) {
            // Convert user input to regex object
            var match = ignore.match(new RegExp('^/(.*)/(.*?)$'));
            return new RegExp(match[1], match[2]);
        }

        return ignore;
    });
}

main();
