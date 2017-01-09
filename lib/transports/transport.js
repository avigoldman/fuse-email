const _ = require('lodash');
const logger = require('../logger');

/** 
 * Base transport for parsing inbound messages and sending outbound messages
 * 
 * @interface
 * @param {Configuration} config
 * @param {Object} extension - the extension from the base
 * @returns {Transport} transport
 */
function Transport(config, extension) {
  /** @namespace Transport */
  const transport = {};

  /**
   * runs the setup needed for the transport to work
   */
  transport.setup = function() {
    logger.debug('Run setup');
  };

  /**
   * validates the inbound request of data
   * 
   * @param {Object} req - the inbound request from express
   * @returns {Boolean} isValid
   */
  transport.validate = function(req) {
    let isValid = !!req;

    return isValid;
  };

  /** 
   * Parses the body into individual inbound messages
   *
   * @param {Object} body
   * @returns {inboundMessage[]} inboundMessages
   */
  transport.parse = function(body) {
    return body;
  };

  /** 
   * returns the conversation the inbound message is part of
   * 
   * @param {InboundMessage} inboundMessage
   * @param {Array} convos - array of conversation objects
   * @returns {Object|false} convo - the conversation or false if none is found
   */
  transport.findConversation = function(inboundMessage, convos) {
    return false;
  };

  /** 
   * Sends email out
   *
   * @param {InboundMessage} inboundMessage
   * @param {OutboundMessage} outboundMessage
   * @param {function} callback
   */
  transport.send = function(inboundMessge, outboundMessage, callback) {
    logger.debug('Sending message...');
    logger.debug(outboundMessage);

    callback(null, true);
  };

  _.extend(transport, extension);

  return transport;
};

module.exports = Transport;