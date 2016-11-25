'use strict';
const logger     = require('./logger');
const _          = require('lodash');
const SparkPost  = require('sparkpost');
const htmlToText = require('html-to-text');


function Email(config) {
  let email = {
    config: config || {}
  };

  if (_.isUndefined(email.config.email_key)) {
    throw new Error("SparkPost API key is required to use SparkPost as the email driver");
  }

  if (_.isUndefined(email.config.sending_address)) {
    throw new Error("A valid sending email address is required");
  }

  if (_.isUndefined(email.config.inbound_address)) {
    throw new Error("An valid inbound email address is required");
  }

  let sparkpost = new SparkPost(email.config.email_key);

  // base send method
  email.send = function(message, cb) {
    let subject = message.subject || ''
      , html = message.html || ''
      , text = message.text || htmlToText.fromString(html)
      , headers = message.headers || {}
      , recipients = message.recipients || [];

    let data = {
      content: {
        from: config.sending_address,
        reply_to: config.inbound_address,
        subject: subject,
        html: html,
        text: text,
        headers: headers
      },
      recipients: recipients
    };

    logger.log('Send message: ', data);

    if (email.config.debug !== true) {
      sparkpost.transmissions.send(data)
        .then((data) => {
          logger.debug('SparkPost response', data);
          
          if (_.isFunction(cb)) {
            cb(null, data);
          }
        })
        .catch((err) => {
          logger.debug('SparkPost error', err);

          if (_.isFunction(cb)) {
            return cb(err);
          }
        });
    }
    // call callback if one was given in debug mode
    else {
      if (_.isFunction(cb)) {
        return cb(null, {});
      }
    }
  };

  // get the recipients to reply to from the given email
  email.getReplyRecipients = function(message) {
    let rawMessage = message._raw;

    // require that at least one direct recipient is defined
    if (_.isUndefined(rawMessage.content.to))
      return [];

    // get all direct recipients
    let recipients = rawMessage.content.to || [];

    for (let i = 0; i < recipients.length; i++) {
      recipients[i] = email.formatRecipient(recipients[i]);
    }

    // add the person who sent the message
    recipients.push(email.formatRecipient(rawMessage.msg_from));

    // remove the bot's addresses
    let clean_sending_address = _.toLower(_.trim(email.config.sending_address));
    let clean_inbound_address = _.toLower(_.trim(email.config.inbound_address));

    removeAddress(recipients, clean_sending_address);
    removeAddress(recipients, clean_inbound_address);

    return recipients;
  };

  // given a string or object format it to be a valid sparkpost recipient
  // {address: }
  email.formatRecipient = function(recipient) {
    return {
      address: {
        email: recipient
      }
    };
  };

  // get the headers object to send in order to reply to the received message
  email.getReplyHeaders = function(message) {
    return {};
  };

  // set up everything with sparkpost
  // 1. create sending domain
  // 2. create inbound domain
  // 3. create relay webhook
  email.setup = function() {
    let sendingDomain = email.config.sending_address.split('@')[1];
    let inboundDomain = email.config.inbound_address.split('@')[1];
    let port           = (email.config.domain.indexOf('localhost') > 0 ? ":" + sparky.config.port : '');
    let webhookTarget = email.config.domain + port + "/" + email.config.webhook;


    logger.debug('Looking up sending domain');
    sparkpost.sendingDomains.get(sending_domain)
      .then((results) => {

      })
      .catch((err) {
        return sparkpost.sendingDomains
      });

  };
  // teardown everything with sparkpost
  // 1. delete sending domain
  // 2. delete inbound domain
  // 3. delete relay webhook
  email.tearDown = function() {
  };

  return email;
};

function removeAddress(recipients, address) {
  _.remove(recipients, function(recipient) {
    let email = _.toLower(_.trim(recipient.address.email));

    return email === address;
  });
}

module.exports = Email;

