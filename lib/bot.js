'use strict';

const logger       = require(__dirname + '/logger');
const _            = require('lodash');
const express      = require('express');
const bodyParser   = require('body-parser');
const Conversation = require(__dirname + '/conversation');

const configDefaults = {
  bot_name   : 'sparky',
  domain     : 'http://localhost',
  endpoint   : '/relay',
  setup      : false,
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
  
  if (sparky.config.setup) {
    sparky.email.setup();
  }

  if (sparky.config.tearDown) {
    sparky.email.tearDown();
  }


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
      let port = (sparky.config.domain.indexOf('localhost') > 0 ? ":" + sparky.config.port : '');
      logger.log('Starting listening at ' + sparky.config.domain + port);

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
      if (_.isString(sparky.config.auth_token) && req.get('X-MessageSystems-Webhook-Token') !== sparky.config.auth_token)
        return res.sendStatus(401);

      res.sendStatus(200);

      var batch = req.body;

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
    let formattedData = sparky.formatMessageData(data);
    let bot = sparky.responder(formattedData);

    let cleanSendingAddress = _.toLower(_.trim(sparky.config.sending_address));
    let cleanInboundAddress = _.toLower(_.trim(sparky.config.inbound_address));
    let cleanText            = _.toLower(data.content.text);

    let triggerParams = [bot, formattedData];

    // kill any messages not sent to the inbound address
    if (_.toLower(_.trim(data.rcpt_to)) !== cleanInboundAddress) {
      logger.debug('Message sent to unkown address: '+data.rcpt_to);
      return;
    }

    logger.debug('Received message from ' + data.msg_from);

    // direct_email
    _.each(data.content.to || [], function(address) {
      address = _.toLower(_.trim(address));
      if (address === cleanSendingAddress || address === cleanInboundAddress) {
        logger.debug('Trigger "direct_email" event');
        sparky.trigger('direct_email', triggerParams);
      }
    });

    // cc_email
    _.each(data.content.cc || [], function(address) {
      address = _.toLower(_.trim(address));
      if (address === cleanSendingAddress || address === cleanInboundAddress) {
        logger.debug('Trigger "cc_email" event');
        sparky.trigger('cc_email', triggerParams);
      }
    });

    // bcc_email -rcpt_to

    // direct_mention
    if (cleanText.indexOf(cleanSendingAddress) >= 0
     || cleanText.indexOf(cleanInboundAddress) >= 0) {
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
    var formatted = {
      to: data.rcpt_to,
      from: data.msg_from,
      subject: data.content.subject,
      text: data.content.text,
      html: data.content.html,
      recipients: data.content.to,
      cc: data.content.cc,
      _raw: data
    };

    var headers = {};
    // go through the headers headers
    _.each(data.content.headers, (header) => {
      // get the keys in the header
      _.each(header, (value, key) => {
        // if the key already exists in the headers object
        if (_.has(headers, key)) {
          // convert it to an array
          if (!_.isArray(headers[key])) {
            headers[key] = [headers[key]]
          }

          // add the new value
          headers[key].push(value);
        }
        // add it in as a string by default
        else {
          headers[key] = value;
        }
      });
    });

    formatted.headers = headers;

    return formatted;
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

        let recipients = data.recipients || sparky.email.getRecipientList(receivedMessage, 'to');
          , cc         = data.cc || sparky.email.getRecipientList(receivedMessage, 'cc');

        // add the person who sent the message to the recipients
        recipients.push(email.formatRecipient(rawMessage.msg_from));

        sparky.email.send({
          subject: data.subject,
          html: data.html || data.body,
          text: data.text,
          headers: data.headers,
          recipients: recipients,
          cc: cc
        });
      },
      reply: function(receivedMessage, data) {
        // set headers to reply to the given message
        data.headers = _.defaults(sparky.email.getReplyHeaders(receivedMessage), data.headers || {});
        data.subject = receivedMessage.subject.indexOf('Re: ') === -1 ? 'Re: ' + receivedMessage.subject : receivedMessage.subject;

        this.say(data);
      }
    };

    return responder;
  };



  return sparky;
}

module.exports = Sparky;