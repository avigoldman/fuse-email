'use strict';

const htmlToText = require('html-to-text');
const _ = require('lodash');
const uniqid = require('uniqid');
const MailParser = require("mailparser").MailParser;

/** 
 * Base transport for parsing inbound messages and sending outbound messages
 * 
 * @interface
 * @param {Configuration} config
 * @param {Object} transport - the extension from the base
 * @returns {Transport} transport
 */
function Transport(config, transport) {
  transport = transport || {};

  /** @namespace Transport */
  const base = {
    logger: config.logger,
    name: 'base'
  };

  /**
   * runs the setup needed for the transport to work
   */
  base.setup = function(callback) {
    transport.ran_setup = true;

    callback = _.defaultTo(callback, _.noop);
    callback();
  };

  /**
   * validates the inbound request of data
   * 
   * @param {Object} req - the inbound request from express
   * @returns {Boolean} isValid
   */
  base.validate = function(req) {
    let isValid = !!req;

    return isValid;
  };

  /** 
   * Parses the body into individual inbound messages
   *
   * @param {Object} body
   * @returns {inboundMessage[]} inboundMessages
   */
  base.parse = function(body, callback) {
    callback(_.castArray(body));
  };

  /** 
   * returns the conversation the inbound message is part of
   * 
   * @param {InboundMessage} inboundMessage
   * @param {Array} convos - array of conversation objects
   * @returns {Object|false} convo - the conversation or false if none is found
   */
  base.findConversation = function(inboundMessage, convos) {
    base.logger.debug('Looking for conversation...');
    if (!_.has(inboundMessage.headers, 'references'))
      return false;

    let messageIds = inboundMessage.headers['references'].split(' ');

    base.logger.debug('Looking in message references...');

    let conversationId = messageIds[0].match(new RegExp("<conversation-id_(.*)>"));

    if (!_.isArray(conversationId))
      return false;

    conversationId = conversationId[1];

    base.logger.debug('ID found: '+conversationId);

    let convo = _.find(convos, function(convo) {
      return convo.id === conversationId;
    });

    if (_.isUndefined(convo)) {
      return false;
    }

    base.logger.debug('Conversation found');

    return convo;
  };

  /** 
   * Sends email out
   *
   * @param {InboundMessage} inboundMessage
   * @param {OutboundMessage} outboundMessage
   * @param {function} callback
   */
  base.send = function(inboundMessage, outboundMessage, callback) {
    callback(null, true);
  };

  /**
   * defaults all the required keys on the inbound message
   *
   * @param {InboundMessage} inboundMessage
   */
  base.defaultInboundMessage = function(inboundMessage) {
    return _.defaultsDeep(inboundMessage, {
      event: '',
      to: {
        email: config.inbound_address,
        name: ''
      },
      from: '',
      subject: '',
      text: '',
      html: '',
      recipients: [],
      cc: [],
      bcc: [],
      headers: {},
      attachments: [],
      _raw: {}
    });
  };

  /**
   * defaults all the required keys on the outbound message
   *
   * @param {OutboundMessage} outboundMessage
   */
  base.defaultOutboundMessage = function(outboundMessage) {
    let html = outboundMessage.html || outboundMessage.body || '';
    let text = outboundMessage.text || htmlToText.fromString(html, config.htmlToTextOpts);
    delete outboundMessage['body'];

    return _.defaultsDeep(outboundMessage, {
      subject: '',
      html:  html,
      text: text,
      headers: {},
      recipients: [],
      cc: [],
      bcc: [],
      from: {
        name: config.name,
        email: config.sending_address
      },
      reply_to: {
        name: config.name,
        email: config.inbound_address
      },
      substitution_data: {},
      attachments: [],
      inline_images: []
    });
  };

  /** 
   * returns the message id or a default auto generated one
   * 
   * @param {InboundMessage} inboundMessage
   * @returns {string} messageId
   */
  base.defaultMessageId = function(inboundMessage) {
    return _.at(inboundMessage, 'headers[message-id]')[0] || `${uniqid()}@${config.sending_address.split('@')[1]}`;
  };


  return _.defaults(transport, base);
};

Transport.extractFromRfc822 = function(body, callback) {
  var mailparser = new MailParser();
  
  mailparser.on("end", function(mail) {
    mail.from = formatInboundRecipients(mail.from);
    mail.to = formatInboundRecipients(mail.to);
    mail.cc = formatInboundRecipients(mail.cc);
    mail.bcc = formatInboundRecipients(mail.bcc);

    callback(mail);
  });

  mailparser.write(body);
  mailparser.end();
};

/**
 * takes an array of emails and formats them to the fuse recipient pattern
 *
 * @param {string[]} recipients
 * @param {object[]} recipients
 */
function formatInboundRecipients(recipients) {
  return _.map(recipients, (recipient) => {
    if (_.isString(recipient)) {
      return {
        email: recipient,
        name: '',
      };
    }
    else {
      return {
        email: recipient.address || '',
        name: recipient.name || ''
      }
    }
  });
}

/** 
 * Modifies the data to be in reply if in reply
 *
 * @param {inboundMessage} inboundMessage
 * @returns {subject} subject
 */
Transport.getReplySubject = function(inboundMessage) {
  return inboundMessage.subject.indexOf('Re: ') === -1 ? 'Re: ' + inboundMessage.subject : inboundMessage.subject;
};

/** 
 * Modifies the data to be in reply if in reply
 *
 * @param {inboundMessage} inboundMessage
 * @returns {Object} headers
 */
Transport.getReplyHeaders = function(inboundMessage) {
  let headers = {
    "References": (inboundMessage.headers['references'] || '') + ' ' + inboundMessage.headers['message-id'] || '',
  };

  if (inboundMessage.headers['message-id']) {
    headers["In-Reply-To"] = inboundMessage.headers['message-id'];
  }

  return headers;
};

module.exports = Transport;