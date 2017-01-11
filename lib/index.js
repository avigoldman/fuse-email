'use strict';

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const utils = require('./utils');
const EventsContext = require('./events');
const Conversation = require('./conversation');
const Transport = require('./transports/transport');

/**
 * Fuse
 * @namespace 
 */
function Fuse(config) {
  const fuse = {
    version: 'dev',
    convos: []
  };

  fuse.config = defaultConfiguration(config);
  fuse.transport = getTransport(fuse.config);
  fuse.logger = fuse.config.logger;

  extendFuse(EventsContext());
  extendFuse(utils);

  fuse.logger.debug('Fuse instance created');

  if (fuse.config.setup) {
    fuse.transport.setup(function() {
      fuse.trigger('ready');
    });
  }
  else {
    fuse.trigger('ready');
  }

  /**
   * @alias extendFuse
   */
  fuse.extend = extendFuse;

  /**
   * Sets up an express server
   * 
   * @param {int} port - The port to run the server on
   * @param {function(err, server)} [callback] - The callback ran when the server is up
   */
  fuse.setupServer = function(port, callback) {
    fuse.config.port = port;
    fuse.server = express();

    fuse.server.use(bodyParser.json());
    fuse.server.use(bodyParser.urlencoded({ extended: true }));

    fuse.server.listen(fuse.config.port, function() {
      let port = (fuse.config.domain.indexOf('localhost') >= 0 ? ":" + fuse.config.port : '');
      fuse.logger.verbose(`Starting listening at ${fuse.config.domain}${port}`);

      if (fuse.config.domain.indexOf('localhost') >= 0) {
        fuse.logger.warn(`Relay services will not be able to send your local server messages. Try using ngrok.`);
      }

      callback = _.defaultTo(callback, _.noop);
      callback(null, fuse.server);
    });
  };
  
  /**
   * Sets up an end point on an express server to receive inbound emails
   * 
   * @param {int} port - The port to run the server on
   * @param {function} [callback] - The callback ran when the endpoint is setup
   */
  fuse.setupEndpoint = function(server, callback) {
    server.post(fuse.config.endpoint, function(req, res) {
      if (!fuse.transport.validate(req))
        return res.sendStatus(401);

      res.sendStatus(200);

      fuse.receive(req.body);
    });

    fuse.logger.verbose(`Endpoint set up at ${fuse.config.endpoint}`);

    callback = _.defaultTo(callback, _.noop);
    callback();
  };

  /**
   * Gets the inbound email data, parses it, and sends it off to be dealt with
   *
   * @param {Object} body
   */
  fuse.receive = function(body) {
    fuse.logger.verbose('Received data');
    let inboundMessages = fuse.transport.parse(body);

    fuse.logger.debug('Handling inbound messages');
    _.each(inboundMessages, fuse.handle);
  };

  /**
   * Get an inbound message and triggers the appropriate event(s)
   *
   * @param {InboundMessage} inboundMessage
   */
  fuse.handle = function(inboundMessage) {
    fuse.transport.defaultInboundMessage(inboundMessage);

    if (isInvalidInboundAddress(inboundMessage.to)) {
      fuse.logger.verbose(`Message sent to unknown address: ${inboundMessage.to}`);
      return;
    }

    let convo = fuse.transport.findConversation(inboundMessage, _.filter(fuse.convos, (convo) => {
      return conv.isActive();
    }));
    
    if (convo) {
      fuse.logger.verbose('Conversation handling message');
      convo.handle(inboundMessage);
      return;
    }

    fuse.logger.verbose('Failed to find conversation');

    let event = getEventType(inboundMessage);

    inboundMessage.event = event;

    let responder = fuse.responder(inboundMessage);

    fuse.logger.verbose(`Triggering ${event}`);
    fuse.trigger(event, [responder, inboundMessage]);

    fuse.logger.verbose('Triggering email_received');
    fuse.trigger('email_received', [responder, inboundMessage]);
  };

  /**
   * returns a responder object tied to the inboundMessage
   *
   * @param {inboundMessage} [inboundMessage]
   * @returns {Object} responder
   */
  fuse.responder = function(inboundMessage) {
    /** @namespace responder */
    var responder = {};

    /** 
     * sends an email with the given data
     * 
     * @param {OutboundMessage} outboundMessage
     * @param {function} [callback]
     */
    responder.send = function(outboundMessage, callback) {

      if (inboundMessage) {
        if ((!_.has(outboundMessage, 'recipients') &&
             !_.has(outboundMessage, 'cc') &&
             !_.has(outboundMessage, 'bcc'))
          || outboundMessage.reply) {
          outboundMessage.recipients = inboundMessage.recipients || [],
          outboundMessage.cc = inboundMessage.cc || []

          outboundMessage = addFromAddress(inboundMessage, outboundMessage);
          outboundMessage = removeToAddress(inboundMessage, outboundMessage);
        }
      }

      fuse.transport.defaultOutboundMessage(outboundMessage);

      fuse.logger.verbose('Sending message');
      fuse.logger.debug(JSON.stringify(outboundMessage, null, 2));

      callback = _.defaultTo(callback, _.noop);
      fuse.transport.send(inboundMessage, outboundMessage, callback);
    };

    /** 
     * replies to the recieved email
     * 
     * @param {OutboundMessage} outboundMessage
     * @param {function} [callback]
     */
    responder.reply = function(outboundMessage, callback) {
      fuse.logger.verbose(`Replying to message ${inboundMessage.id}`);

      outboundMessage.reply = true;
      
      responder.send(outboundMessage, callback);
    };
    
    /**
     * starts a conversation with the people on the inboundMessage or the given recipients/cc
     * 
     * @param {ConversationConfig} conversationConfig
     * @param {function} [callback]
     */
    responder.startConversation = function(config, callback) {
      config = _.isString(config) ? { subject: config } : config;

      _.defaults(config, {
        subject: inboundMessage.subject,
        recipients: inboundMessage.recipients || [],
        cc: inboundMessage.cc || []
      });

      config = addFromAddress(inboundMessage, config);
      config = removeToAddress(inboundMessage, config);

      var convo = Conversation(fuse, config, callback);

      fuse.convos.push(convo);

      convo.start();
    };
    
    /**
     * starts a conversation with the person who sent the inboundMessage
     * 
     * @param {ConversationConfig} conversationConfig
     * @param {function} [callback]
     */
    responder.startPrivateConversation = function(subject, callback) {
      if (_.isUndefined(inboundMessage))
        return false;

      fuse.logger.verbose(`Starting private conversation with ${inboundMessage.from}`);

      responder.startConversation({
        subject: subject,
        recipients: [ inboundMessage.from ]
      }, callback);
    };

    return responder;
  };

  /**
   * Overrides hear test for events
   *
   */
  fuse.hearTest = function(patterns, params) {
    let bodyTests = patterns;
    let subjectTests = patterns;

    if (_.isPlainObject(patterns)) {
      bodyTests = patterns.body || [];
      subjectTests = patterns.subject || [];
    }

    return fuse._defaultHearTest(bodyTests, [fuse.clean(fuse.getLatest(params.body))]) || fuse._defaultHearTest(subjectTests, [params.subject]);
  };

  /**
   * returns boolean on if the recieving email is accepted
   *
   * @param {string} inboundAddress
   */
  function isInvalidInboundAddress(inboundAddress) {
    if (fuse.config.restrict_inbound === false)
      return false;

    return cleanAddress(inboundAddress) !== fuse.config.inbound_address;
  }

  /**
   * Combines fuse and the given object
   *
   * @param {Object} extend
   * @returns {Object} fuse
   */
  function extendFuse(extend) {
    return _.defaultsDeep(fuse, extend);
  }

  /** 
   * returns a string with the event type of this message
   *
   * @param {InboundMessage} inboundMessage
   * @returns {string} eventType
   */
  function getEventType(inboundMessage) {
    if (_.max([inboundMessage.recipients.indexOf(fuse.config.inbound_address),
               inboundMessage.recipients.indexOf(inboundMessage.to)]) >= 0) {
      return 'direct_email';
    }
    else if (_.max([inboundMessage.cc.indexOf(fuse.config.inbound_address),
                    inboundMessage.cc.indexOf(inboundMessage.to)]) >= 0) {
      return 'cc_email';
    }
    else {
      return 'bcc_email';
    }
  }


  return fuse;
}

module.exports = Fuse;

/** 
 * gets the address that sent the inbound message and adds it as a recipient to the outbound message
 *
 * @param {InboundMessage} inboundMessage
 * @param {OutboundMessage} outboundMessage
 * @returns {OutboundMessage} outboundMessage
 */
function addFromAddress(inboundMessage, outboundMessage) {
  if (inboundMessage && _.has(inboundMessage, 'from')) {
    outboundMessage.recipients = outboundMessage.recipients || [];

    outboundMessage.recipients.push(inboundMessage.from);
  }

  return outboundMessage;
}

/** 
 * gets the address that received the inbound message and removes it from the outbound recipients and cc lists
 * (we don't wanna send the email to ourselves)
 *
 * @param {InboundMessage} inboundMessage
 * @param {OutboundMessage} outboundMessage
 * @returns {OutboundMessage} outboundMessage
 */
function removeToAddress(inboundMessage, outboundMessage) {
  if (inboundMessage && _.has(inboundMessage, 'to')) {
    outboundMessage.recipients = _.filter(outboundMessage.recipients || [], (recipient) => {
      return recipient !== inboundMessage.to;
    });
    outboundMessage.cc = _.filter(outboundMessage.cc || [], (recipient) => {
      return recipient !== inboundMessage.to;
    });
  }

  return outboundMessage;
}

/**
 * cleans the address
 * 
 * @param {string} address
 * @returns {string} address
 */
function cleanAddress(address) {
  return _.toLower(_.trim(address));
}

/**
 * get the transport based on the config
 * 
 * @param {Configuration} config
 * @returns {Transport} transport
 */
function getTransport(config) {
  return require(`./transports/${config.transport}`)(config);
}

/** 
 * generate the config
 *
 * @param {Object} config - the given config
 * @returns {Configuration} config
 */
function defaultConfiguration(config) {
  config = _.defaults({}, config, {
    name: 'Sparky',
    endpoint: '/relay',
    setup: true,
    convos: [],
    sending_address: config.address,
    inbound_address: config.address,
    transport: 'sparkpost',
    restrict_inbound: true,
    logger: 'verbose'
  });

  config.logger = _.isString(config.logger) ? require('./logger')(config.logger) : config.logger;

  return config;
}