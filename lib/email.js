'use strict';
const logger       = require(__dirname + '/logger');
const _            = require('lodash');
const SparkPost    = require('sparkpost');
const htmlToText   = require('html-to-text');
const dns          = require('dns');


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
    let cleanSendingDomain = _.toLower(_.trim(email.config.sending_address));
    let cleanInboundDomain = _.toLower(_.trim(email.config.inbound_address));

    removeAddress(recipients, cleanSendingDomain);
    removeAddress(recipients, cleanInboundDomain);

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
    let port          = (email.config.domain.indexOf('localhost') > 0 ? ":" + sparky.config.port : '');
    let webhookTarget = email.config.domain + port + "/" + email.config.endpoint;
    let webhookName   = email.config.bot_name + " Webhook";

    let completed = false;


    logger.log('=========================');
    logger.log('to skip this set setup to false in the config');

    sendingDomainSetup(function() {
      inboundDomainSetup(function() {
        webhookSetup();
      });
    });

    function sendingDomainSetup(cb) {
      // get the sending domain
      logger.log('Looking up sending domain...');
      sparkpost.sendingDomains.get(sendingDomain)
        // create sending domain
        .catch((err) => {
          logger.log('Domain does not exist\nCreating sending domain...');
          return sparkpost.sendingDomains.create({
            domain: sendingDomain
          });
        })
        // verify sending domain
        .then((data) => {
          logger.log('Domain exists\nVerifying sending domain...');
          return sparkpost.sendingDomains.verify(sendingDomain, {
            dkim_verify: true,
            spf_verify: true
          });
        })
        .then((data) => {
          if (data.results.ownership_verified) {
            logger.log('Domain verified');
            // go onto the next step
            if (_.isFunction(cb)) {
              return cb();
            }
          }

          throw new Error('Please verify your sending domain by following the instructions here:\nhttps://support.sparkpost.com/customer/portal/articles/1933360-verify-sending-domains');
        })
        .catch(throwUpError);
    }

    function inboundDomainSetup(cb) {
      // get the inbound domain
      logger.log('Looking up inbound domain...');
      sparkpost.inboundDomains.get(inboundDomain)
        // create the inbound domain
        .catch(() => {
          logger.log('Domain does not exist\nCreating inbound domain...');
          return sparkpost.inboundDomains.create({
            domain: inboundDomain
          });
        })
        //verify domain
        .then((data) => {
          logger.log('Domain exists\nVerifying inbound domain...');

          // get the mx records
          dns.resolveMx(inboundDomain, function(err, mxRecords) {
            let sparkpostMxRecords = ['rx1.sparkpostmail.com', 'rx2.sparkpostmail.com', 'rx3.sparkpostmail.com'];

            if (err)
              throw err;
            
            // remove the mx record from the sparkpostMxRecords array as it is found in the domains mx records
            _.each(mxRecords, (mxRecord) => {
              let index = _.indexOf(sparkpostMxRecords, mxRecord.exchange);

              if (index >= 0)
                sparkpostMxRecords.splice(index, 1);
            });

            if (sparkpostMxRecords.length > 0) {
              throw new Error('Inbound Domain failed to verify. Missing records: '+sparkpostMxRecords+'\n verify it by following the instructions here:\nhttps://support.sparkpost.com/customer/portal/articles/2039614-enabling-inbound-email-relaying-relay-webhooks');
            }
            else {
              logger.log('Domain verified');
              // go on to the next step
              if (_.isFunction(cb)) {
                cb();
              }
            }
          });
        })
        .catch(throwUpError);
    }

    function webhookSetup(cb) {
      // function to call at the end of the webhook setup
      function finished() {
        logger.log('Setup succeeded!');
        logger.log('=========================');

        // go on to the next step
        if (_.isFunction(cb)) {
          cb();
        }
      }

      logger.log('Looking up relay webhooks...');
      // get all webhooks
      sparkpost.relayWebhooks.list()
        // create the webhook
        .then((data) => {
          let webhookWithSameDomain = _.filter(data.results, { match: { domain: inboundDomain } });

          let webhookOptions = {
            name: webhookName,
            target: webhookTarget,
            match: {
              protocol: "SMTP",
              domain: inboundDomain
            }
          };

          if (_.isString(email.config.auth_token))
            webhookOptions.auth_token = email.config.auth_token;

          // if the webhook doesn't currently exist...
          if (webhookWithSameDomain.length === 0) {
            logger.log('Relay webhook does not exist with the given inbound domain\nCreating relay webhook...');

            return sparkpost.relayWebhooks.create(webhookOptions)
              .then((data) => {
                logger.log('Relay webhook created');
                
                finished();
              });
          }
          else {
            logger.log('Relay webhook exists');

            // update the relay webhook if the targets don't match
            if (webhookWithSameDomain[0].target !== webhookTarget) {
              logger.warn('The existing webhook does not match the relay webhook target.');
              return sparkpost.relayWebhooks.update(webhookWithSameDomain[0].id, webhookOptions)
              .then((data) => {
                logger.log('Relay webhook updated');
                
                finished();
              });
            }
            
            // if it already exists the setup also succeeded
            finished();
          }
        })
        .catch(throwUpError);
    }
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

function throwUpError(err) {
  if (err.name === 'SparkPostError')
    console.log(JSON.stringify(err.errors, null, 2));

  setTimeout(function() { throw err; });
}

module.exports = Email;
