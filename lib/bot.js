'use strict';

const logger       = require(__dirname + '/logger');
const _            = require('lodash');
const express      = require('express');
const bodyParser   = require('body-parser');
const Conversation = require(__dirname + '/conversation');

const configDefaults = {
  bot_name   : 'sparky',
  domain     : 'http://localhost',
  endpoint   : 'inbound',
  setup      : true,
  tearDown   : false,
  auth_token : null,
  debug      : false
};

function Sparky(config) {
  var sparky = {
    email: null,
    memory: null,
    config: _.defaults(config || {}, configDefaults, {
      sending_address: config.address,
      inbound_address: config.address,
    }),
  };
  if (sparky.config.debug) {
    logger.debug("");
    logger.debug("|============================|");
    logger.debug("|         Debug Mode         |");
    logger.debug("| -------------------------- |");
    logger.debug("|   No emails will be sent   |");
    logger.debug("|============================|");
    logger.debug("");
  }

  // email driver setup
  sparky.email = require(__dirname + '/email')(sparky.config);
  
  if (sparky.config.setup)
    sparky.email.setup();

  if (sparky.config.tearDown)
    sparky.email.tearDown();


  // memory setup
  sparky.memory = _.isUndefined(sparky.config.memory) ? require(__dirname + '/memory') : sparky.config.memory;

  // base convo setup
  sparky = _.extend(sparky, Conversation());


  /**
   * Sets up an express server
   */
  sparky.setupServer = function(port, cb) {
    if (_.isUndefined(port)) {
      throw new Error('Cannot start webserver without a port');
    }

    sparky.config.port = port;
    sparky.server = express();

    sparky.server.use(bodyParser.json());
    sparky.server.use(bodyParser.urlencoded({ extended: true }));

    sparky.server.listen(sparky.config.port, function() {
      logger.log('Starting listening on port ' + sparky.config.port);

      if (cb) {
        cb(null, sparky.server); 
      }
    });
  };

  /**
   * sets up the inbound endpoint on the given server
   */
  sparky.setupEndpoint = function(server, cb) {
    server.post(sparky.config.endpoint, function(req, res) {
      if (_.isString(sparky.config.auth_token) && req.body['X-MessageSystems-Webhook-Token'] !== sparky.config.auth_token)
        res.status(401);

      res.sendStatus(200)

      const batch = req.body;

      for (let i = 0; i < batch.length; i++) {
        sparky.processMessage(batch[i].msys.relay_message);
      }
    });

    if (cb) {
      cb();
    }


    return this;
  };


  /**
   * Processes the data given by sparkpost
   */
  sparky.processMessage = function(data) {
    logger.debug('Email received from: ', data.msg_from);
    logger.debug('Email subject: ', data.content.subject);
    
    let formattedData = sparky.formatMessageData(data);
    let bot = sparky.responder(formattedData);

    let cleanSendingDomain = _.toLower(_.trim(sparky.config.sending_address));
    let cleanInboundDomain = _.toLower(_.trim(sparky.config.inbound_address));
    let cleanText            = data.content.text.toLowerCase();

    let triggerParams = [bot, formattedData];

    // direct_email
    _.each(data.content.to || [], function(address) {
      address = address.toLowerCase().trim();
      if (address === cleanSendingDomain || address === cleanInboundDomain) {
        logger.debug('Trigger "direct_email" event');
        sparky.trigger('direct_email', triggerParams);
      }
    });

    // cc_email
    _.each(data.content.cc || [], function(address) {
      address = address.toLowerCase().trim();
      if (address === cleanSendingDomain || address === cleanInboundDomain) {
        logger.debug('Trigger "cc_email" event');
        sparky.trigger('cc_email', triggerParams);
      }
    });

    // bcc_email -rcpt_to

    // direct_mention
    if (cleanText.indexOf(cleanSendingDomain) >= 0
     || cleanText.indexOf(cleanInboundDomain) >= 0) {
      logger.debug('Trigger "direct_mention" event');
      sparky.trigger('direct_mention', triggerParams);
    }

    // mention
    if (cleanText.indexOf(sparky.config.bot_name.toLowerCase()) >= 0) {
      logger.debug('Trigger "mention" event');
      sparky.trigger('mention', triggerParams);
    }

    // email_received
    logger.debug('Trigger "email_received" event');
    sparky.trigger('email_received', triggerParams);
  };

  /**
   * Formats the data into the data to be given to the handlers
   */
  sparky.formatMessageData = function(data) {
    data._raw = data;
    return data;
  };


  /**
   * Returns a new responder object with the following methods
   * 
   * reply, say, startConveration
   */
  sparky.responder = function(receivedMessage) {
    var responder = {
      say: function(data) {
        if (!_.isPlainObject(data)) {
          throw new Error('Your message must be an object');
        }

        if (_.isUndefined(data.subject) && _.isUndefined(data.body)){
          throw new Error('Your message must have a subject or body at minimum')
        }

        logger.debug('Say:', data);

        let recipients = data.recipients || sparky.email.getReplyRecipients(receivedMessage);

        sparky.email.send({
          subject: data.subject,
          html: data.html || data.body,
          text: data.text,
          headers: data.headers,
          recipients: recipients
        });
      },
      reply: function(receivedMessage, data) {
        // set headers to reply to the given message
        data.headers = sparky.email.getReplyHeaders(receivedMessage);

        this.say(data);
      }
    };

    return responder;
  };



  return sparky;
}

module.exports = Sparky;