const _            = require('lodash');
const SparkPost    = require('sparkpost');
const htmlToText   = require('html-to-text');
const dns          = require('dns');

const logger = require('../logger.js');
const Transport = require('./transport');

/**
 * @implements {Transport} 
 */
function SparkPostTransport(config) {
  const transport = {};

  let sparkpost = new SparkPost(config.email_key);

  // set up everything with sparkpost
  // 1. create sending domain
  // 2. create inbound domain
  // 3. create relay webhook
  transport.setup = function() {

    let sendingDomain = config.sending_address.split('@')[1];
    let inboundDomain = config.inbound_address.split('@')[1];
    let port          = (config.domain.indexOf('localhost') > 0 ? ":" + config.port : '');
    let webhookTarget = config.domain + port + config.endpoint;
    let webhookName   = config.name + " Webhook";

    logger.log('=========================');
    logger.log('to skip this set setup to false in config');

    sendingDomainSetup(function() {
      inboundDomainSetup(function() {
        webhookSetup();
      });
    });

    function sendingDomainSetup(callback) {
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
        logger.log('Setup succeeded!');
        logger.log('=========================');

        // go on to the next step
        if (_.isFunction(callback)) {
          callback();
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

          if (_.isString(config.auth_token))
            webhookOptions.auth_token = config.auth_token;

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
            if (webhookWithSameDomain[0].target !== webhookTarget || webhookWithSameDomain[0].auth_token !== webhookOptions.auth_token) {
              logger.warn('The existing webhook does not match the relay webhook options.');
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

  transport.validate = function(req) {
    return _.isString(config.auth_token) && req.get('X-MessageSystems-Webhook-Token') === config.auth_token;
  };

  transport.parse = function(body) {
    let inboundMessages = [];

    for (let i = 0; i < body.length; i++) {
      inboundMessages.push(toInboundMessage(body[i].msys.relay_message));
    }

    return inboundMessages;
  };

  transport.findConversation = function(inboundMessage, convos) {

  };

  transport.send = function(inboundMessage, outboundMessage, callback) {
    let contentDefaults = {
      from: '"' + config.name + '" <' + config.sending_address + '>',
      reply_to: '"' + config.name + '" <' + config.inbound_address + '>',
      subject: '',
      html: '',
      text: htmlToText.fromString(outboundMessage.html || '', config.htmlToTextOpts),
      headers: {},
      attachments: [],
      inline_images: []
    };

    let contentValues = _.keys(contentDefaults);

    let content = _.pick(_.defaultsDeep({}, outboundMessage, contentDefaults), contentValues);


    let data = _.extend(_.omit(outboundMessage, contentValues), {
      content: content,
      recipients: formatRecipients(outboundMessage.recipients),
      cc: formatRecipients(outboundMessage.bcc),
      bcc: formatRecipients(outboundMessage.cc),
    });

    logger.debug('Send message: ', JSON.stringify(data, null, 2));

    sparkpost.transmissions.send(data)
      .then((data) => {
        logger.debug('SparkPost response', data);
        
        callback(null, data);
      })
      .catch((err) => {
        logger.debug('SparkPost error', err);

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
    const ignoreAddresses = [config.sending_address, config.inbound_address];
    let newRecipients = [];

    _.each(recipients, (recipient) => {
      if (_.indexOf(ignoreAddresses, recipient) == -1) {
        newRecipients.push({
          address: {
            email: recipient
          }
        });
      }
    });

    return newRecipients;
  }

  return Transport(config, transport);
};

/**
 * Takes a relay message from sparkpost and converts it to an inboundMessage
 *
 * @param {Object} data
 * @returns {InboundMessage} inboundMessage
 */
function toInboundMessage(data) {
  let inboundMessage = _.defaults({
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

  let headers = formatHeaders(data);

  formatted.headers = headers;

  return formatted;
}


/**
 * converts headers to correct inboundMessage format
 *
 * @param {Object} data
 * @return {Object} headers
 */
function formatHeaders(data) {
  let headers = {};
  
  _.each(data.content.headers, (header) => {
    _.each(header, (value, key) => {
      // add to array
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