# Chokidar CLI

[![Build Status](https://travis-ci.org/kimmobrunfeldt/chokidar-cli.svg?branch=master)](https://travis-ci.org/kimmobrunfeldt/chokidar-cli)

Ultra-fast cross-platform command line utility to watch file system changes.

The underlying watch library is [Chokidar](https://github.com/paulmillr/chokidar), which is one of the best watch utilities for Node. Chokidar is battle-tested:

> It is used in
> [brunch](http://brunch.io),
> [karma](http://karma-runner.github.io),
> [PM2](https://github.com/Unitech/PM2),
> [browserify](http://browserify.org/),
> [webpack](http://webpack.github.io/),
> [BrowserSync](http://www.browsersync.io/),
> [socketstream](http://www.socketstream.org),
> [derby](http://derbyjs.com/),
> and [many others](https://www.npmjs.org/browse/depended/chokidar/).
> It has proven itself in production environments.

## Install

If you need it only with NPM scripts:

```bash
npm install chokidar-cli
```

Or globally

```bash
npm install -g chokidar-cli
```

## Usage

**Run *npm run build-js* whenever any .js file changes in the current work directory tree**

```watch '**/*.js' 'npm run build-js'```

**Watching in network directories must use polling**

```watch '**/*.less' 'npm run build-less' --polling```

**Detailed help**

```
Usage: watch <pattern> <command> [options]

<pattern>:
Glob pattern to specify files to be watched.
Needs to be surrounded with quotes to prevent shell globbing.
Guide to globs: https://github.com/isaacs/node-glob#glob-primer

<command>:
Command to be executed when a change is detected.
Needs to be surrounded with quotes when command contains spaces

Options:
  -d, --debounce          Debounce timeout in ms for executing command
                                                                  [default: 400]
  -s, --follow-symlinks   When not set, only the symlinks themselves will be
                          watched for changes instead of following the link
                          references and bubbling events through the links path
                                                     [boolean]  [default: false]
  -i, --ignore            Pattern for files which should be ignored. Needs to
                          be surrounded with quotes to prevent shell globbing.
                          The whole relative or absolute path is tested, not
                          just filename
  -p, --polling           Whether to use fs.watchFile(backed by polling)
                          instead of fs.watch. This might lead to high CPU
                          utilization. It is typically necessary to set this to
                          true to successfully watch files over a network, and
                          it may be necessary to successfully watch files in
                          other non-standard situations
                                                     [boolean]  [default: false]
  --poll-interval         Interval of file system polling. Effective when
                          --polling is set                        [default: 100]
  --poll-interval-binary  Interval of file system polling for binary files.
                          Effective when --polling is set         [default: 300]
  -h, --help              Show help
  -v, --version           Show version number

Examples:
  watch "**/*.js" "npm run build-js"    build when any .js file changes
```

## License

MIT
