'use strict';
var dargs = require('dargs');
var es = require('event-stream');
var exec = require('child_process').exec;
var gitLatestTag = require('git-latest-tag');
var _ = require('lodash');

function hasCommits(done) {
  exec('git log', function(err, stdout, stderr) {
    if (err || stderr || !String(stdout).trim()) {
      done(stderr);
    } else {
      done(null, '');
    }
  });
}

function getLatestTag(done) {
  gitLatestTag(true, function(err, tag) {
    if (err) {
      hasCommits(done);
    } else {
      done(null, tag);
    }
  });
}

function gitRawCommits(options, done) {
  if (typeof options === 'function') {
    done = options;
    options = {};
  }

  done = done || function() {};

  var throughStream = es.through();

  getLatestTag(function(err, latestTag) {
    if (err || latestTag === undefined) {
      if (done === true) {
        return console.log(err);
      }
      return done(err);
    }

    options = _.extend({
      from: latestTag,
      to: 'HEAD'
    }, options);
    var args = dargs(options, {
      excludes: ['from', 'to']
    });
    var cmd = _.template(
      'git log --format=%H%n%s%n%b%n==END== ' +
      '<%= from ? [from, to].join("..") : to %>'
    )(options) + args.join(' ');

    var stream = es.child(exec(cmd))
      .pipe(es.split('\n==END==\n'))
      .pipe(es.map(function(data, callback) {
        if (data) {
          callback(null, data);
        } else {
          callback();
        }
      }));

    if (done === true) {
      stream.pipe(process.stdout);
    } else {
      stream.pipe(throughStream).pipe(es.writeArray(done));
    }
  });

  return throughStream;
}

module.exports = gitRawCommits;