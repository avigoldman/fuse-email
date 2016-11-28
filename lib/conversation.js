'use strict';

const logger = require(__dirname + '/logger');
const _      = require('lodash');
const uuid   = require('node-uuid');

function Conversation(config, sparky, cb) {

  if (_.isUndefined(config.topic) || _.isUndefined(config.recipients)) {
    throw new Error('Conversation requires a topic and an array of recipients');
  }

  if (_.isUndefined(config.domain)) {
    throw new Error('Domain required for conversation');
  }

  var convo = {
    id: uuid.v4() + '@' + config.domain,
    topic: config.topic,
    status: 'active', // active, finished, timeout
    timeout_after: (60 * 10 || config.timeout_after) * 1000, // give in seconds - defaults to 10 minutes
    timeout_function: null,
    handler: null,
    message_ids: [],
    messages: [],
    transcript: [],
    threads: {},
    recipients: config.recipients,
    cc: config.cc || []
  };

  logger.debug('Conversation created with id ' + convo.id);

  convo.start = function() {
    logger.debug('Conversation ' + convo.id + ' started');
    cb(convo);

    // if they didn't ask a question in the conversation then end it
    if (!_.isFunction(convo.handler)) {
      convo.end();
    }

    convo.timeout_function = setTimeout(convo.timeout, convo.timeout_after);
  };

  convo.handle = function(message) {
    logger.debug('Conversation ' + convo.id + ' received message id ' + message.headers['Message-ID']);

    logger.debug('reset timeout function for Conversation ' + convo.id);
    clearTimeout(convo.timeout_function);
    convo.timeout_function = setTimeout(convo.timeout, convo.timeout_after);

    // add all the new message ids (probably just the one we just sent)
    var newMessageIds = _.difference(message.headers['References'].split(' '), convo.message_ids);
    // update the message ids to have the new Message Ids minus the conversation id
    convo.message_ids = _.filter(convo.message_ids.concat(newMessageIds), function(messageId) {
      return messageId.indexOf('conversation-id') === -1;
    });
    // add the message id that we just received
    convo.message_ids.push(message.headers['Message-ID']);
    // add it to the transcript and messagse
    convo.messages.push(message);
    convo.transcript.push(message);

    if (_.isFunction(convo.handler)) {
      convo.handler.apply(convo, [convo, message]);

      // if they didn't ask another question in the conversation then end it
      if (!_.isFunction(convo.handler)) {
        convo.end();
      }
    }
    else {
      convo.end();
    }
  };

  convo.end = function(status) {
    clearTimeout(convo.timeout_function);

    convo.timeout_function = null;

    logger.debug('Conversation ' + convo.id + ' ended');
    convo.status = status || 'finished';
    convo.handler = null;
  };

  convo.timeout = function() {
    logger.debug('Conversation ' + convo.id + ' timed out');
    convo.end('timeout');
  };

  convo.say = function(data) {
    logger.debug('Conversation says...');
    data.headers = _.defaults(convo.getReplyHeaders(), data.headers || {});
    data.subject = convo.hasMessages() ? 'Re: ' + convo.topic : convo.topic;

    data.recipients = convo.recipients;
    data.cc = convo.cc;

    convo.transcript.push(data);

    sparky.bot().say(data);
  };

  convo.ask = function(data, handler) {
    logger.debug('Conversation asks...');

    convo.say(data);
    convo.handler = handler;
  };

  convo.getReplyHeaders = function() {
    var headers = {
      "References": "<conversation-id_" + convo.id + "> " + convo.message_ids.join(' ')
    };

    if (convo.hasMessages()) {
      headers["In-Reply-To"] = _.last(convo.message_ids);
    }


    return headers;
  };

  convo.hasMessages = function() {
    return convo.message_ids.length > 0;
  }

  convo.isActive = function() {
    return convo.status === 'active';
  }

  return convo;
}

module.exports = Conversation;