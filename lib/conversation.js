'use strict';

const logger = require(__dirname + '/logger');
const _      = require('lodash');
const uuid   = require('node-uuid');

function Conversation(config, sparky, cb) {

  if (_.isUndefined(config.topic) || _.isUndefined(config.recipients)) {
    throw new Error('Conversation requires a topic and an array of recipients');
  }

  var convo = {
    id: uuid.v4(),
    topic: config.topic,
    status: 'active', // active, finished, timeout
    handler: null,
    message_ids: [],
    messages: [],
    transcript: [],
    threads: {},
    recipients: config.recipients,
    cc: config.cc || []
  };

  convo.handle = function(message) {
    // add all the new message ids (probably just the one we just sent)
    var newMessageIds = _.difference(message.headers['References'].split(' '), convo.message_ids);
    // update the message ids to have the new Message Ids minus the conversation id
    convo.message_ids = _.filter(convo.message_ids.concat(newMessageIds), function(messageId) {
      return messageId.indexOf('conversation-id') === -1;
    });
    // add the message id that we just recieved
    convo.message_ids.push(message.headers['Message-ID']);
    // add it to the transcript and messagse
    convo.messages.push(message);
    convo.transcript.push(message);

    if (_.isFunction(convo.handler)) {
      convo.handler.apply(convo, [convo, message]);
    }
    else {
      convo.end();
    }
  };

  convo.end = function(status) {
    convo.status = status || 'finished';
    convo.handler = null;
  };

  convo.timeout = function() {
    convo.end('timeout');
  }

  convo.say = function(data) {
    data.headers = _.defaults(convo.getReplyHeaders(), data.headers || {});
    data.subject = convo.hasMessages() ? 'Re: ' + convo.topic : convo.topic;

    data.recipients = convo.recipients;
    data.cc = convo.cc;

    convo.transcript.push(data);

    sparky.bot().say(data);
  };

  convo.ask = function(data, handler) {
    convo.say(data);
    convo.handler = handler;
  };

  convo.getReplyHeaders = function() {
    var headers = {
      "References": "<conversation-id:" + convo.id + "> " + convo.message_ids.join(' ')
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