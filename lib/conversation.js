'use strict';

const logger = require(__dirname + '/logger');
const _      = require('lodash');

function Conversation() {
  var convo = {
    events: {}
  };

  /**
   * registers a listener on the given event
   */ 
  convo.on = function(event, cb) {
    logger.debug('Setting up a handler for', event);

    var events = toArray(event);

    _.each(events, (event) => {
      if (_.isUndefined(convo.events[event]))
        convo.events[event] = [];

      convo.events[event].push(cb);
    });
  };

  /**
   * Registers a listener on the given event and pattern set
   *
   * If one of these handlers is triggered no following handlers are
   */
  convo.hears = function(pattern, events, cb) {

    var patterns = toArray(patterns);

    convo.on(events, function(bot, message) {
      if (didIHear(patterns, message)) {
        cb.apply(convo, [bot, message]);

        // stop any other handlers from triggering
        return false;
      }
    });
  };


  /**
   * triggers the given event with the specified params
   */
  convo.trigger = function(event, params) {
    if (!_.isUndefined(convo.events[event])) {
      _.each(convo.events[event], (eventHandler) => {
        return eventHandler.apply(convo, params);
      });
    }
    else {
      logger.debug('No handler for', event);
    }
  };

  return convo;
}

function toArray(str) {
  return _.isString(str) ? str.split(',') : str;
}

function didIHear(patterns, message) {
  let subjectPatterns = []
    , bodyPatterns =  [];

  if (_.isArray(patterns)) {
    subjectPatterns = bodyPatterns = patterns;
  }
  else {
    if (_.has(patterns, 'subject')) {
      subjectPatterns = toArray(patterns.subject);
    }
    else if(_.has(patterns, 'body')) {
      bodyPatterns = toArray(patterns.body);
    }
    else {
      throw new Error('Pattern for subject or body must be provided');
    }
  }

  let matches = [];

  // test subject
  _.each(subjectPatterns, (pattern) => {
    let match = null
      , test = getTest(pattern);

    if (match = message.subject.match(test)) {
      matches.push({
        source: 'subject',
        match: match
      });
    }
  });


  // test body
  _.each(bodyPatterns, (pattern) => {
    let match = null
      , test = getTest(pattern);

    if (match = message.html.match(test)) {
      matches.push({
        source: 'html',
        match: match
      });
    }

    if (match = message.text.match(test)) {
      matches.push({
        source: 'text',
        match: match
      });
    }
  });

  if (matches.length > 0) {
    message.matches = matches;
    return true;
  }

  return false;
}

function getTest(pattern) {
  if (_.isString(pattern)) {
    try {
      return new RegExp(pattern, 'i');
    }
    catch (err) {
      throw new Error('Error in pattern: ' + pattern + '\n' + err);
    }
  }

  return pattern;
}

module.exports = Conversation;