'use strict';

const logger       = require(__dirname + '/logger');
const _            = require('lodash');
const express      = require('express');
const bodyParser   = require('body-parser');
const htmlToText   = require('html-to-text');
const Conversation = require(__dirname + '/conversation');

const configDefaults = {
  bot_name: 'sparky',
  domain: 'http://localhost',
  endpoint: '/relay',
  setup: false,
  auth_token: null,
  debug: false,
  restrict_inbound: true
};

function SparkyBot(config) {
  var sparky = {
    events: {},
    convos: [],
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

  // memory setup
  sparky.memory = _.isUndefined(sparky.config.memory) ? require(__dirname + '/memory') : sparky.config.memory;

  // base convo setup
  sparky = _.extend(sparky, Conversation());

  // setup everything for the bot
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

  // processing incoming messages
  /**
   * Processes the data given by sparkpost
   */
  sparky.processMessage = function(data) {
    let formattedMessage = sparky.formatMessageData(data);
    let bot = sparky.bot(formattedMessage);

    let cleanSendingAddress = _.toLower(_.trim(sparky.config.sending_address));
    let cleanInboundAddress = _.toLower(_.trim(sparky.config.inbound_address));
    let cleanText            = _.toLower(data.content.text);

    let triggerParams = [bot, formattedMessage];

    // kill any messages not sent to the inbound address
    if (_.toLower(_.trim(data.rcpt_to)) === cleanInboundAddress && sparky.config.restrict_inbound === true) {
      logger.debug('Message sent to unkown address: '+data.rcpt_to);
      return;
    }

    logger.debug('Received message from ' + data.msg_from);

    let originalRecipients = _.map(data.content.to || [], (recipient) => { return _.toLower(_.trim(recipient)); });
    let ccRecipients = _.map(data.content.cc || [], (recipient) => { return _.toLower(_.trim(recipient)); });

    let convo = sparky.findConversation(formattedMessage);
    if (convo !== false) {
      convo.handle(formattedMessage);
      return;
    }

    if (originalRcipients.indexOf(cleanSendingAddress) >= 0 || originalRcipients.indexOf(cleanInboundAddress) >= 0) {
      logger.debug('Trigger "direct_email" event');
      sparky.trigger('direct_email', triggerParams);
    }
    else if (ccRecipients.indexOf(cleanSendingAddress) >= 0 || ccRecipients.indexOf(cleanInboundAddress) >= 0) {
      logger.debug('Trigger "cc_email" event');
      sparky.trigger('cc_email', triggerParams);
    }
    else {
      logger.debug('Trigger "bcc_email" event');
        sparky.trigger('bcc_email', triggerParams);
    }

    // always trigger email_received
    logger.debug('Trigger "email_received" event');
    sparky.trigger('email_received', triggerParams);
  };

  /**
   * Formats the data into the data to be given to the handlers
   */
  sparky.formatMessageData = function(data) {
    var formatted = _.defaults({
        to: data.rcpt_to,
        from: data.msg_from,
        subject: data.content.subject,
        text: data.content.text,
        html: data.content.html,
        recipients: data.content.to,
        cc: data.content.cc,
        _raw: data
      }, {
        to: '',
        from: '',
        subject: '',
        text: '',
        html: '',
        recipients: [],
        cc: []
      });

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
   * Returns a new bot object with the following methods
   * 
   * reply, say, startConversation
   */
  sparky.bot = function(receivedMessage) {
    var bot = {
      say: function(data) {
        if (!_.isPlainObject(data)) {
          throw new Error('Your message must be an object');
        }

        if (_.isUndefined(data.subject) && _.isUndefined(data.body)) {
          throw new Error('Your message must have a subject or body at minimum')
        }

        logger.debug('Say:', data);

        let recipients = data.recipients || sparky.email.getRecipientList(receivedMessage, 'to')
          , cc         = data.cc || sparky.email.getRecipientList(receivedMessage, 'cc');
          , bcc        = data.bcc || [];

        // add the person who sent the message to the recipients
        if (!_.isUndefined(receivedMessage))
          recipients.push(sparky.email.formatRecipient(receivedMessage.from));

        sparky.email.send({
          subject: data.subject,
          html: data.html || data.body,
          text: data.text,
          headers: data.headers,
          recipients: recipients,
          cc: cc,
          bcc: bcc
        });
      },
      reply: function(receivedMessage, data) {
        // set headers to reply to the given message
        data.headers = _.defaults(sparky.email.getReplyHeaders(receivedMessage), data.headers || {});
        data.subject = receivedMessage.subject.indexOf('Re: ') === -1 ? 'Re: ' + receivedMessage.subject : receivedMessage.subject;

        this.say(data);
      },
      // start a conversation with everyone on the email
      startConversation: function(config, cb) {
        if (_.isString(config)) {
          config = {
            topic: config,
            recipients: sparky.email.getRecipientList(receivedMessage, 'to'),
            cc: sparky.email.getRecipientList(receivedMessage, 'cc')
          };

          if (!_.isUndefined(receivedMessage))
            config.recipients.push(sparky.email.formatRecipient(receivedMessage.from));
        }

        var newConvo = Conversation(config, sparky, cb);
        sparky.convos.push(newConvo);
      },
      // start a conversation with the person who sent the email
      startPrivateConversation: function(topic, cb) {
        bot.startConversation({
          topic: topic,
          recipients: [ sparky.email.formatRecipient(receivedMessage.from) ]
        }, cb);
      }
    };

    return bot;
  };

  // Event handlers
  /**
   * registers a listener on the given event
   */ 
  sparky.on = function(event, cb) {
    logger.debug('Setting up a handler for', event);

    var events = toArray(event);

    _.each(events, (event) => {
      if (_.isUndefined(sparky.events[event]))
        sparky.events[event] = [];

      sparky.events[event].push(cb);
    });
  };

  /**
   * Registers a listener on the given event and pattern set
   *
   * If one of these handlers is triggered no following handlers are
   */
  sparky.hears = function(pattern, events, cb) {

    var patterns = toArray(pattern);

    sparky.on(events, function(bot, message) {
      if (didIHear(patterns, message)) {
        cb.apply(sparky, [bot, message]);

        // stop any other handlers from triggering
        return false;
      }
    });
  };

  /**
   * triggers the given event with the specified params
   */
  sparky.trigger = function(event, params) {
    if (!_.isUndefined(sparky.events[event])) {
      _.each(sparky.events[event], (eventHandler) => {
        return eventHandler.apply(sparky, params);
      });
    }
    else {
      logger.debug('No handler for', event);
    }
  };

  // Helper functions
  sparky.clean = function(input) {
    return htmlToText.fromString(input).replace(/(\r\n|\n|\r)/gm,"");
  };

  return sparky;
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





module.exports = SparkyBot;