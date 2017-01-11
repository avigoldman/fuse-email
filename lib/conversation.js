'use strict';

const _ = require('lodash');
const uniqid = require('uniqid');
const IS_WAIT_FUNCTION = 'is-wait-function';
/**
 * starts a conversation with the people on the inboundMessage or the given recipients/cc
 * 
 * @param {Object} fuse - a fuse instance
 * @param {ConversationConfig} config
 * @param {function} [activationCallback]
 */
function Conversation(fuse, config, activationCallback) {
  
  const id = uniqid()+'@'+fuse.config.sending_address.split('@')[1]; 

  const convo = {
    id: id,
    status: 'sitting', // sitting, active, finished, timeout
    handler: null,
    timeout_after: config.timeout_after || 1000*60*10, // 10 minutes
    timeout_function: null,
    inboundMessages: [],
    transcript: [],
    wait_count: 0, // number of times the message has been retriggered
    wait_count_max: 3,
    wait_time: 1000*30
  };

  fuse.logger.verbose(`Conversation created with id ${convo.id}`);

  /**
   * starts the conversation
   */
  convo.start = function() {
    fuse.logger.verbose(`Conversation ${convo.id} started`);

    convo.status = 'active';

    startTimeout();

    activationCallback(convo);

    // if they didn't ask a question in the conversation then end it
    if (!_.isFunction(convo.handler)) {
      convo.end();
    }
  };

  /**
   * handles inboundMessages that are part of the convo
   *
   * @param {InboundMessage} inboundMessage
   */
  convo.handle = function(inboundMessage) {

    fuse.logger.verbose(`Conversation ${convo.id} received message id ${inboundMessage.id}`);

    if (_.isFunction(convo.handler)) {
      addInboundMessageToConvo(inboundMessage);

      runTheHandler(inboundMessage);

      // if they didn't ask another question in the conversation then end it
      if (!_.isFunction(convo.handler)) {
        convo.end();
      }
    }
    // if this happens it needs to be hear by the regular listeners
    else {
      convo.end();

      retriggerMessage(inboundMessage);
    }
  }; 

  /**
   * ends the convo with the given status or finished
   *
   * @param {string} status
   */
  convo.end = function(status) {
    convo.status = status || 'finished';
    convo.handler = null;

    fuse.logger.verbose(`Conversation ${convo.id} ended with status: ${convo.status}`);

    clearTimeout(convo.timeout_function);
  };

  /**
   * ends the convo because of a timeout
   */
  convo.timeout = function() {
    convo.end('timeout');
  };

  /**
   * replys to the last email
   * 
   * @see fuse.responder.reply
   */
  convo.say = function(outboundMessage, callback) {
    convo.transcript.push(outboundMessage);
      
    let latestMessage = getLatestMessage();

    if (latestMessage) {
      fuse.responder(latestMessage).reply(outboundMessage, callback);
    }
    // build the inital message to send
    else {
      fuse.logger.debug(`Sending initial message`);
      outboundMessage.recipients = config.recipients;
      outboundMessage.cc = config.cc;
      outboundMessage.headers = outboundMessage.headers || {};
      outboundMessage.headers['References'] = `<conversation-id_${convo.id}>`;
      outboundMessage.subject = config.subject;

      fuse.responder().say(outboundMessage, callback);
    }
  };

  /**
   * replys to the last email and attaches handler for the next message
   *
   * @param {OutboundMessage} outboundMessage
   * @param {function} handler
   * @param {function(err, results)} callback
   */
  convo.ask = function(outboundMessage, handler, callback) {
    convo.say(outboundMessage);
    convo.handler = handler;
  };

  /** 
   * registers a temporary handler that if called retriggers the message at a later point for up to wait_count_max times
   */
  convo.wait = function() {
    fuse.logger.verbose('Waiting for ask');
    // set up handler
    convo.handler = function(convo, response) {
      fuse.logger.verbose('Waiting...');
      convo.wait_count++;

      if (convo.wait_count > convo.wait_count_max) {
        fuse.logger.verbose(`Waited ${convo.wait_count_max} times. Ending conversation.`);
        return;
      }

      // retriggers message if the convo is asked to handle it and we can still wait
      setTimeout(function() {
        retriggerMessage(response);
      }, convo.wait_time);

      return IS_WAIT_FUNCTION;      
    };
  };

  /**
   * returns true if the convo has received at least one email
   *
   * @returns {Boolean} hasMessages
   */
  convo.hasMessages = function() {
    return convo.inboundMessages.length > 0;
  }; 

  /** 
   * returns true if the convo is active
   *
   * @returns {Boolean} isActive
   */
  convo.isActive = function() {
    return convo.status === 'active';
  }

  /** 
   * gets the latest message or if none is found, it mocks up the references for the reply method
   */
  function getLatestMessage() {
    if (convo.hasMessages())
      return _.last(convo.inboundMessages);

    return false;
  }

  /**
   * runs the handler with the inboundMessage
   *
   * @param {InboundMessage} inboundMessage
   */
  function runTheHandler(inboundMessage) {
    let handler = convo.handler;
    convo.handler = null;
    
    let result = handler.apply(convo, [convo, inboundMessage]);

    
    if (result === IS_WAIT_FUNCTION) {
      // reset the handler to wait again
      convo.handler = handler;
    }
    // this was a real interaction so reset the timeout and wait count
    else {
      fuse.logger.verbose('Ran handler');
      resetTimeout();
      convo.wait_count = 0;
    }
  }

  /**
   * retriggers message in fuse
   *
   * @param {InboundMessage} inboundMessage
   */
  function retriggerMessage(inboundMessage) {
    fuse.handle(inboundMessage);
  }

  /**
   * adds new received messages to the transcript and inboundMessages list
   *
   * @param {InboundMessage} inboundMessage
   */
  function addInboundMessageToConvo(inboundMessage) {
    if (_.last(convo.inboundMessages) !== inboundMessage) {
      fuse.logger.debug(`Add ${inboundMessage.id} to transcript`);
      convo.inboundMessages.push(inboundMessage);
      convo.transcript.push(inboundMessage);
    }
  }

  /**
   * starts timer for timeout from 0
   */
  function resetTimeout() {
    clearTimeout(convo.timeout_function);

    convo.timeout_function = setTimeout(function() {
      convo.timeout();
    }, convo.timeout_after);
  }

  /**
   * @alias resetTimeout
   */
  function startTimeout() {
    resetTimeout();
  }

  return convo;
}

module.exports = Conversation;