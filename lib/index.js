const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');

const logger = require('./logger');
const helpers = require('./helpers');
const EventsContext = require('./events');
const Conversation = require('./conversation');

_.mixin({ tryCall: function() {
  let fn = _.first(arguments);

  if (_.isFunction(fn)) {
    arguments.shift()
    return fn.apply(fn, arguments);
  }
}});

/**
 * Fuse
 * @namespace 
 */
function Fuse(config) {
  const fuse = {};

  fuse.config = defaultConfiguration(config);
  fuse.transport = getTransport(fuse.config);

  extendFuse(EventsContext());
  extendFuse(helpers);

  if (fuse.config.setup)
    fuse.transport.setup();

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
    if (_.isUndefined(port)) {
      throw new Error('Cannot start webserver without a port');
    }

    fuse.config.port = port;
    fuse.server = express();

    fuse.server.use(bodyParser.json());
    fuse.server.use(bodyParser.urlencoded({ extended: true }));

    fuse.server.listen(fuse.config.port, function() {
      let port = (fuse.config.domain.indexOf('localhost') > 0 ? ":" + fuse.config.port : '');
      logger.log('Starting listening at ' + fuse.config.domain + port);

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

    callback = _.defaultTo(callback, _.noop);
    callback();
  };

  /**
   * Gets the inbound email data, parses it, and sends it off to be dealt with
   *
   * @param {Object} body
   */
  fuse.receive = function(body) {
    let inboundMessages = fuse.transport.parse(body);

    _.each(inboundMessages, fuse.handle);
  };

  /** 
   * Get an inbound message and triggers the appropriate event(s)
   *
   * @param {InboundMessage} inboundMessage
   */
  fuse.handle = function(inboundMessage) {
    if (isInvalidInboundAddress(inboundMessage)) {
      logger.debug('Message sent to unknown address: '+inboundMessage.to);
      return;
    }

    let convo = fuse.transport.findConversation(inboundMessage, fuse.convos);
    
    if (convo) {
      convo.handle(inboundMessage);
      return;
    }

    let event = getEventType(inboundMessage);

    inboundMessage.event = event;

    let responder = sparky.responder(inboundMessage);

    fuse.trigger(event, [responder, inboundMessage]);

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
    responder.say = function(outboundMessage, callback) {
      outboundMessage.html = outboundMessage.html || outboundMessage.body;
      delete outboundMessage['body'];

      if (inboundMessage) {
        outboundMessage.recipients = outboundMessage.recipients || [];

        outboundMessage.recipients.push(inboundMessage.from);
      }

      logger.debug('Say:', outboundMessage);

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

      outboundMessage.reply = true;
      
      this.say(outboundMessage, callback);
    };
    
    /**
     * starts a conversation with the people on thie inboundMessage
     * 
     * @param {ConversationConfig} outboundMessage
     * @param {function} [callback]
     */
    responder.startConversation = function(config, callback) {};
    
    // start a conversation with the person who sent the email
    responder.startPrivateConversation = function(topic, callback) {};

    return responder;
  };

  /**
   * returns boolean on if the recieving email is accepted
   *
   * @param {string} inboundAddress
   */
  function isInvalidInboundAddress(inboundAddress) {
    return cleanAddress(inboundAddress) !== fuse.config.inbound_address && fuse.config.restrict_inbound === true;
  }

  /**
   * Combines fuse and the given object
   *
   * @param {Object} extend
   * @returns {Object} fuse
   */
  function extendFuse(extend) {
    return _.merge(fuse, extend);
  }

  return fuse;
}

module.exports = Fuse;

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
  return _.defaults({}, config, {
    name: 'sparky',
    endpoint: '/relay',
    setup: true,
    convos: [],
    sending_address: config.address,
    inbound_address: config.address,
    transport: 'sparkpost',
    restrict_inbound: true
  });
}

/** 
 * returns a string with the event type of this message
 *
 * @param {InboundMessage} inboundMessage
 * @returns {string} eventType
 */
function getEventType(inboundMessage) {
  if (inboundMessage.recipients.indexOf(fuse.config.inbound_address) >= 0) {
    return 'direct_email';
  }
  else if (inboundMessage.cc.indexOf(fuse.config.inbound_address) >= 0) {
    return 'cc_email';
  }
  else {
    return 'bcc_email';
  }
}
