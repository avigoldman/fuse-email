'use strict';

const _ = require('lodash');
const SparkPost = require('sparkpost');
const dns = require('dns');
const Transport = require('./transport');

/**
 * @implements {Transport} 
 */
function SparkPostTransport(config) {
  const transport = {
    name: 'sparkpost'
  };

  let sparkpost = new SparkPost(config.email_key);

  // set up everything with sparkpost
  // 1. create sending domain
  // 2. create inbound domain
  // 3. create relay webhook
  transport.setup = function(callback) {
    let sendingDomain = config.sending_address.split('@')[1];
    let inboundDomain = config.inbound_address.split('@')[1];
    let port          = (config.domain.indexOf('localhost') > 0 ? ":" + config.port : '');
    let webhookTarget = config.domain + port + config.endpoint;
    let webhookName   = config.name + " Webhook";

    transport.logger.verbose('=========================');
    transport.logger.verbose('Setup started');
    transport.logger.debug('===========================');

    sendingDomainSetup(function() {
      inboundDomainSetup(function() {
        webhookSetup(function() {
          transport.logger.debug('===========================');
          transport.logger.verbose('Setup complete');
          transport.logger.verbose('=========================');

          callback = _.defaultTo(callback, _.noop);
          callback();
        });
      });
    });

    function sendingDomainSetup(callback) {
      // get the sending domain
      transport.logger.debug('Looking up sending domain...');
      sparkpost.sendingDomains.get(sendingDomain)
        // create sending domain
        .catch((err) => {
          transport.logger.debug('Domain does not exist\nCreating sending domain...');
          return sparkpost.sendingDomains.create({
            domain: sendingDomain
          });
        })
        // verify sending domain
        .then((data) => {
          transport.logger.debug('Domain exists');
          transport.logger.debug('Verifying sending domain...');
          return sparkpost.sendingDomains.verify(sendingDomain, {
            dkim_verify: true,
            spf_verify: true
          });
        })
        .then((data) => {
          if (data.results.ownership_verified) {
            transport.logger.debug('Domain verified');
            // go onto the next step
            if (_.isFunction(callback)) {
              return callback();
            }
          }

          throw new Error('Please verify your sending domain by following the instructions here:\nhttps://support.sparkpost.com/customer/portal/articles/1933360-verify-sending-domains');
        })
        .catch(throwUpError);
    }

    function inboundDomainSetup(callback) {
      // get the inbound domain
      transport.logger.debug('Looking up inbound domain...');
      sparkpost.inboundDomains.get(inboundDomain)
        // create the inbound domain
        .catch(() => {
          transport.logger.debug('Domain does not exist\nCreating inbound domain...');
          return sparkpost.inboundDomains.create({
            domain: inboundDomain
          });
        })
        //verify domain
        .then((data) => {
          transport.logger.debug('Domain exists');
          transport.logger.debug('Verifying inbound domain...');

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
              transport.logger.debug('Domain verified');
              // go on to the next step
              if (_.isFunction(callback)) {
                callback();
              }
            }
          });
        })
        .catch(throwUpError);
    }

    function webhookSetup(callback) {
      // function to call at the end of the webhook setup
      function finished() {
        // go on to the next step
        if (_.isFunction(callback)) {
          callback();
        }
      }

      transport.logger.debug('Looking up relay webhooks...');
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

          if (_.isString(config.auth_token))
            webhookOptions.auth_token = config.auth_token;

          // if the webhook doesn't currently exist...
          if (webhookWithSameDomain.length === 0) {
            transport.logger.debug('Relay webhook does not exist with the given inbound domain\nCreating relay webhook...');

            return sparkpost.relayWebhooks.create(webhookOptions)
              .then((data) => {
                transport.logger.debug('Relay webhook created');
                
                finished();
              });
          }
          else {
            transport.logger.debug('Relay webhook exists');

            // update the relay webhook if the targets don't match
            if (webhookWithSameDomain[0].target !== webhookTarget || webhookWithSameDomain[0].auth_token !== webhookOptions.auth_token) {
              transport.logger.debug('The existing webhook does not match the relay webhook options.');
              return sparkpost.relayWebhooks.update(webhookWithSameDomain[0].id, webhookOptions)
              .then((data) => {
                transport.logger.debug('Relay webhook updated');
                
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

  transport.validate = function(req) {
    if (!_.isString(config.auth_token))
      return true;
    
    return req.get('X-MessageSystems-Webhook-Token') === config.auth_token;
  };

  transport.parse = function(body) {
    let inboundMessages = [];

    for (let i = 0; i < body.length; i++) {
      inboundMessages.push(toInboundMessage(body[i].msys.relay_message));
    }

    return inboundMessages;
  };

  transport.send = function(inboundMessage, outboundMessage, callback) {
    let contentKeys = [ 'html', 'text', 'subject', 'from', 'reply_to', 'headers', 'attachments', 'inline_images'];

    let content = _.pick(outboundMessage, contentKeys);

    let data = _.merge(_.omit(outboundMessage, _.concat(contentKeys, 'recipients', 'cc', 'bcc')), {
      content: content,
      recipients: formatRecipients(outboundMessage.recipients),
      cc: formatRecipients(outboundMessage.cc),
      bcc: formatRecipients(outboundMessage.bcc),
    });

    data = handleReply(inboundMessage, data);

    transport.logger.debug('Send data to SparkPost');

    sparkpost.transmissions.send(data)
      .then((data) => {
        transport.logger.debug('SparkPost response', JSON.stringify(data, null, 2));
        
        callback(null, data);
      })
      .catch((err) => {
        transport.logger.debug('SparkPost error', JSON.stringify(err, null, 2));

        callback(err);
      });
  };

  /**
   * takes an array of emails and formats them for the SparkPost api
   *
   * @param {string[]} recipients
   * @param {object[]} recipients
   */
  function formatRecipients(recipients) {
    return _.map(recipients, (recipient) => {
      return {
        address: recipient
      };
    });
  }

  /**
   * Takes a relay message from sparkpost and converts it to an inboundMessage
   *
   * @param {Object} data
   * @returns {InboundMessage} inboundMessage
   */
  function toInboundMessage(data) {
    let inboundMessage = transport.defaultInboundMessage({
        to: data.rcpt_to,
        from: data.msg_from,
        subject: data.content.subject,
        text: data.content.text,
        html: data.content.html,
        recipients: data.content.to,
        cc: data.content.cc,
        _raw: data
      });

    let headers = formatInboundMessageHeaders(data);

    inboundMessage.headers = headers;

    inboundMessage.id = transport.defaultMessageId(inboundMessage);

    return inboundMessage;
  }

  return Transport(config, transport);
};

/** 
 * Modifies the data to be in reply if in reply
 *
 * @param {inboundMessage} inboundMessage
 * @param {Object} data - the data for the SparkPost API
 * @returns {Object} data
 */
function handleReply(inboundMessage, data) {
  if (data.reply) {
    _.merge(data.content.headers, Transport.getReplyHeaders(inboundMessage));

    data.content.subject = Transport.getReplySubject(inboundMessage);

    delete data.reply;
  }

  return data;
}

/**
 * converts headers to correct inboundMessage format
 *
 * @param {Object} data
 * @return {Object} headers
 */
function formatInboundMessageHeaders(data) {
  let headers = {};
  
  _.each(data.content.headers, (header) => {
    _.each(header, (value, key) => {
      
      key = _.toLower(key);

      // add to array if more then one value
      if (_.has(headers, key)) {
        headers[key] = _.castArray(headers[key]);

        headers[key].push(value);
      }
      // add it in as a string by default
      else {
        headers[key] = value;
      }
    });
  });

  return headers;
}

/**
 * Logs error for sparkpost reponse
 * 
 * @param {Error} err
 */
function throwUpError(err) {
  if (err.name === 'SparkPostError')
    console.log(JSON.stringify(err.errors, null, 2));

  setTimeout(function() { throw err; });
}

module.exports = SparkPostTransport;