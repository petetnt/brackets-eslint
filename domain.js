/*eslint no-process-env:0*/
/*global require, exports*/

(function () {
  'use strict';

  var fs = require('fs');
  var CLIEngine = require('eslint').CLIEngine;
  var cli = new CLIEngine();
  var currentProjectRoot = null;
  var domainName = 'zaggino.brackets-eslint';
  var domainManager = null;
  var noop = function () {};

  function _setProjectRoot(projectRoot) {
    var opts = {};
    var rulesDirPath;
    var ignorePath;

    if (projectRoot) {
      rulesDirPath = projectRoot + '.eslintrules';
      try {
        if (fs.statSync(rulesDirPath).isDirectory()) {
          opts.rulePaths = [rulesDirPath];
        }
      } catch (e) {
        // no action required
        noop(e);
      }

      ignorePath = projectRoot + '.eslintignore';
      try {
        if (fs.statSync(ignorePath).isFile()) {
          opts.ignore = true;
          opts.ignorePath = ignorePath;
        }
      } catch (e) {
        // no action required
        noop(e);
      }
    }

    cli = new CLIEngine(opts);
  }

  require('enable-global-packages').on('ready', function () {
    // global packages are available now
    _setProjectRoot(currentProjectRoot);
  });

  // --- catch some of uncaughtExceptions so Brackets won't crash
  var uncaughtExceptionHandlers = process._events.uncaughtException;
  if (!Array.isArray(uncaughtExceptionHandlers)) { uncaughtExceptionHandlers = [ uncaughtExceptionHandlers ]; }
  process.removeAllListeners('uncaughtException');
  process.on('uncaughtException', function (err) {
    var stack = err.stack;
    var tests = [
      /Cannot find module '([^']+)'/,
      /extensions(\\|\/)user(\\|\/)brackets-eslint(\\|\/)domain\.js:/
    ];
    var results = tests.map(function (test) {
      return !!stack.match(test);
    });
    var rethrow = results.indexOf(false) !== -1;
    if (rethrow) {
      uncaughtExceptionHandlers.forEach(function (handler) {
        handler(err);
      });
    } else {
      console.error('uncaughtException caught by brackets-eslint: ' + stack);
    }
  });
  // ---

  function lintFile(fullPath, projectRoot, callback) {
    if (projectRoot !== currentProjectRoot) {
      _setProjectRoot(projectRoot);
      currentProjectRoot = projectRoot;
    }
    fs.readFile(fullPath, {encoding: 'utf8'}, function (err, text) {
      if (err) {
        return callback(err);
      }
      var relativePath = fullPath.indexOf(projectRoot) === 0 ? fullPath.substring(projectRoot.length) : fullPath;

      // this is important for ESLint so .eslintrc is properly loaded
      // we could go around this by parsing .eslintrc manually but that'd
      // bring complexity we don't need here right now
      process.chdir(projectRoot);

      callback(null, cli.executeOnText(text, relativePath));
    });
  }

  exports.init = function (_domainManager) {
    domainManager = _domainManager;

    if (!domainManager.hasDomain(domainName)) {
      domainManager.registerDomain(domainName, {
        major: 0,
        minor: 1
      });
    }

    domainManager.registerCommand(
      domainName,
      'lintFile', // command name
      lintFile, // handler function
      true, // is async
      'lint given file with eslint', // description
      [
        {
          name: 'fullPath',
          type: 'string'
        },
        {
          name: 'projectRoot',
          type: 'string'
        }
      ], [
        {
          name: 'report',
          type: 'object'
        }
      ]
    );

  };

}());
