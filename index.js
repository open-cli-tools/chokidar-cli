#!/usr/bin/env node

'use strict';

const throttle = require('lodash.throttle');
const debounce = require('lodash.debounce');
const chokidar = require('chokidar');
const yargs = require('yargs');
const { version: chokidarVersion } = require('chokidar/package.json');
const { version } = require('./package.json');
const utils = require('./utils');

const EVENT_DESCRIPTIONS = {
    add: 'File added',
    addDir: 'Directory added',
    unlink: 'File removed',
    unlinkDir: 'Directory removed',
    change: 'File changed'
};

const defaultOpts = {
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
    command: null
};

const VERSION = `chokidar-cli: ${version}\nchokidar: ${chokidarVersion}`;

const {argv} = yargs
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
    .version(VERSION);

function main() {
    const userOpts = getUserOpts(argv);
    const opts = Object.assign(defaultOpts, userOpts);
    startWatching(opts);
}

function getUserOpts(argv) {
    argv.patterns = argv._;
    return argv;
}

// Estimates spent working hours based on commit dates
function startWatching(opts) {
    const chokidarOpts = createChokidarOpts(opts);
    const watcher = chokidar.watch(opts.patterns, chokidarOpts);

    let throttledRun = run;
    if (opts.throttle > 0) {
        throttledRun = throttle(run, opts.throttle);
    }

    let debouncedRun = throttledRun;
    if (opts.debounce > 0) {
        debouncedRun = debounce(throttledRun, opts.debounce);
    }

    watcher.on('all', (event, path) => {
        const description = `${EVENT_DESCRIPTIONS[event]}:`;

        if (opts.verbose) {
            console.error(description, path);
        } else if (!opts.silent) {
            console.log(`${event}:${path}`);
        }

        // XXX: commands might be still run concurrently
        if (opts.command) {
            debouncedRun(
                opts.command
                    .replace(/\{path\}/ig, path)
                    .replace(/\{event\}/ig, event)
            );
        }
    });

    watcher.on('error', error => {
        console.error('Error:', error);
        console.error(error.stack);
    });

    watcher.once('ready', () => {
        const list = opts.patterns.join('", "');
        if (!opts.silent) {
            console.error('Watching', `"${list}" ..`);
        }
    });
}

function createChokidarOpts(opts) {
    // Transform e.g. regex ignores to real regex objects
    opts.ignore = _resolveIgnoreOpt(opts.ignore);

    const chokidarOpts = {
        followSymlinks: opts.followSymlinks,
        usePolling: opts.polling,
        interval: opts.pollInterval,
        binaryInterval: opts.pollIntervalBinary,
        ignoreInitial: !opts.initial
    };

    if (opts.ignore) {
        chokidarOpts.ignored = opts.ignore;
    }

    return chokidarOpts;
}

// Takes string or array of strings
function _resolveIgnoreOpt(ignoreOpt) {
    if (!ignoreOpt) {
        return ignoreOpt;
    }

    const ignores = Array.isArray(ignoreOpt) ? ignoreOpt : [ignoreOpt];

    return ignores.map(ignore => {
        const isRegex = ignore[0] === '/' && ignore[ignore.length - 1] === '/';
        if (isRegex) {
            // Convert user input to regex object
            const match = ignore.match(/^\/(.*)\/(.*?)$/);
            return new RegExp(match[1], match[2]);
        }

        return ignore;
    });
}

function run(cmd) {
    return utils.run(cmd)
        .catch(error => {
            console.error('Error when executing', cmd);
            console.error(error.stack);
        });
}

main();
