/********************
 ** Bundler Logger **
 ********************
 */

var fs = require('fs');
var chalk = require('chalk');

function joinAsString(items, joiner) {
  return items.map(function (item) { return item.toString(); }).join(joiner);
}

// Act like an enum of log levels
const LogLevels = { silly: 1, debug: 2, info: 3, verbose: 4, warning: 5, error: 6, none: 100};
const LevelNames = ['', 'silly', 'debug', 'info', 'verbose', 'warning', 'error'];

function coloring(color, prefix) {
  return function (str) {
    return color(prefix + ' ' + str);
  };
}

const LogColors = [
  null,
  coloring(chalk.bgMagenta.yellow, '[SILLY]'),
  coloring(chalk.green, '[DEBUG]'),
  coloring(chalk.bgWhite.black, '[INFO]'),
  coloring(chalk.bgBlack.white, '[VERBOSE]'),
  coloring(chalk.bgBlack.red, '[WARNING]'),
  coloring(chalk.bgYellow.black, '[ERROR]')
];

/**
 * Standard line-based log formatter
 * @param {string} level - The name of the log level to log at
 * @param {[any]} args - The array of arguments to log out
 */
function formatLine(level, args) {
  return LogColors[level](joinAsString(args, ' '));
}

/**
 * JSON-based log formatter used to log argument and level information instead of just text
 * @param {string} level - The name of the log level to log at
 * @param {[any]} args - The array of arguments to log out
 */
function formatJSON(level, args) {
  var obj = {
    logLevel: level,
    arguments: args.length,
    tag: LogColors[level],
    logLevelName: LevelNames[level]
  };
  for (var i = 0, len = args.length; i < len; i++) {
    obj[i] = args[i];
  }
  return JSON.stringify(obj);
}

/**
 * Create a writer that logs to stdout.
 */
function stdoutWriter() {
  return {
    write: function (str) { console.log(str); },
    close: function () {}
  };
}

/**
 * Create a writer that logs to stderr.
 */
function stderrWriter() {
  return {
    write: function (str) { console.error(str); },
    close: function () {}
  };
}

/**
 * Create a writer that logs to a file.
 * @param {string} filename - The path to the file to log to
 */
function fileWriter(filename) {
  var fileID = fs.openSync(filename, 'a');
  return {
    write: function (str) {
      fs.writeSync(fileID, str + '\n');
    },
    close: function () {
      fs.closeSync(fileID); }
  };
}

/**
 * Create a logger
 * @constructor
 * config {
 *   threshold: LogLevel, - The minimum log level at which a log is written
 *   default: optional object {
 *     outputs: [function (string) null],
 *     formatter: function (LogLevel, [arguments]) string,
 *   },
 *   silly: optional object, - Same as `default` - How to log at LogLevel.silly
 *   ...
 *   error: optional object, - Same as `default` - How to log at LogLevel.error
 */
function Logger(config) {
  this.threshold = config.hasOwnProperty('threshold') ? config.threshold : LogLevel.debug;
  this.outputs = {};
  this.formatters = {};
  if (config.hasOwnProperty('default')) {
    this.outputs.default = config.default.outputs.slice(0);
    this.formatters.default = config.default.formatter;
  } else {
    this.outputs.default = [consoleOutput]
    this.fomatters.default = lineFormatter
  }
  var logLevels = Object.keys(LogLevels);
  for (var i = 0, len = logLevels.length; i < len; i++) {
    var level = logLevels[i];
    if (config.hasOwnProperty(level)) {
      this.outputs[level] = config[level].outputs.slice(0);
      this.formatters[level] = config[level].formatter;
    }
  }
}

/**
 * Invoke each of the log writer functions assigned for a given log level if it
 * exceeds the configured threshold value after calling the appropriate formatter.
 * @param {string} level - The name of the log level to use
 * @param {[any]} args   - The data to output
 */
Logger.prototype._log = function (level, args) {
  if (level >= this.threshold) {
    var formatter = null;
    var outputs = null;
    levelName = LevelNames[level];
    if (this.outputs.hasOwnProperty(levelName)) {
      formatter = this.formatters[levelName];
      outputs = this.outputs[levelName];
    } else {
      formatter = this.formatters.default;
      outputs = this.outputs.default;
    }
    var formatted = formatter(level, args);
    for (var i = 0, len = outputs.length; i < len; i++) {
      outputs[i].write(formatted);
    }
  }
};

/* Convenience methods to call log at each output level */

/**
 * Convert an array-like object containing integer keys into an array
 */
function objToArray(obj) {
  var arr = [];
  var nKeys = Object.keys(obj);
  for (var i = 0, len = nKeys.length; i < len; i++) {
    var key = nKeys[i];
    arr.push(obj[key]);
  }
  return arr;
}

Logger.prototype.log = function (level) {
  this._log(level, objToArray(arguments));
};

Logger.prototype.silly = function () {
  this._log(LogLevels.silly, objToArray(arguments));
};

Logger.prototype.debug = function () {
  this._log(LogLevels.debug, objToArray(arguments));
};

Logger.prototype.info = function () {
  this._log(LogLevels.info, objToArray(arguments));
};

Logger.prototype.verbose = function () {
  this._log(LogLevels.verbose, objToArray(arguments));
};

Logger.prototype.warning = function () {
  this._log(LogLevels.warning, objToArray(arguments));
};

Logger.prototype.error = function () {
  this._log(LogLevels.error, objToArray(arguments));
};

/**
 * Called to free resources held by the logger.
 */
Logger.prototype.destroy = function () {
  var outputs = Object.keys(this.outputs);
  for (var i = 0, len = outputs.length; i < len; i++) {
    var levelName = outputs[i];
    var outputMethods = this.outputs[levelName];
    for (var j = 0, len2 = outputMethods.length; j < len2; j++) {
      var method = outputMethods[j];
      method.close();
    }
  }
};

var noLogging = {
  threshold: logging.LogLevels.none,
  default: {
    outputs: [],
    formatter: function () { return null; }
  }
};

module.exports = {
  Logger: Logger,
  LogLevels: LogLevels,
  formatLine: formatLine,
  formatJSON: formatJSON,
  stdoutWriter: stdoutWriter,
  stderrWriter: stderrWriter,
  fileWriter: fileWriter,
  noLogging: noLogging
}
