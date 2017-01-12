[![Build Status](https://travis-ci.org/avrahamgoldman/fuse-email.svg?branch=master)](https://travis-ci.org/avrahamgoldman/fuse-email)
[![Coverage Status](https://coveralls.io/repos/github/avrahamgoldman/fuse-email/badge.svg)](https://coveralls.io/github/avrahamgoldman/fuse-email)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# Fuse - automating email conversations
### A framework for writing conversational email responders

[SparkPost](https://sparkpost.com) is a cloud email service that allows developers to send and receive emails.

This is a botkit-inspired framework written around the SparkPost API to make it easy to automate email conversations.

##### Table of Contents
[Getting Started](#getting-started)<br>
[Initialization](#initialization)<br>
[Start Listening](#start-listening)<br>
[The Address Object](#the-address-object)<br>
[Receiving Messages](#receiving-messages)<br>
[Sending Messages](#sending-messages)<br>
[Having Conversations](#having-conversations)<br>
[Helper Functions](#helper-functions)<br>


## Getting Started

Before setting this framework up you'll first need a SparkPost account. SparkPost lets you send 100,000 emails for free which should be plenty to get started. You can sign up [here](https://app.sparkpost.com/sign-up).

### Creating an API Key

For this framework to work, you will need to create an API Key with the following access:

Sending Domains: Read/Write<br>
Inbound Domains: Read/Write<br>
Relay Webhooks: Read/Write<br>
Transmissions: Read/Write<br>

To create the key visit the [API Keys](https://app.sparkpost.com/account/credentials) section in the SparkPost app under Account. 
Once there selected the required permissions and store the generated key somewhere safe as you won't be able to access it again.

### Configuring your sending domain
The sending domain is the domain that you will send emails from (.e.g. hi.there@sendingdomain.com).

Add your domain in the [Sending Domains](https://app.sparkpost.com/account/sending-domains) section. You'll need to verify ownership of the domain through the methods provided in the UI. 

### Configuring your inbound domain

Your inbound domain is the domain at which you will receive emails. It can be the same address as your sending domain.

Add the following MX records to your inbound domain's DNS

Name | Type | Data | Priority
---- | ---- | ---- | --------
`your.inbounddomain.com` | MX | rx1.sparkpostmail.com | 10
`your.inbounddomain.com` | MX | rx2.sparkpostmail.com | 10
`your.inbounddomain.com` | MX | rx3.sparkpostmail.com | 10

## Setting up your fuse
Once the DNS changes have propagated (you can check the [mxtoolbox](https://mxtoolbox.com/)), its time to build your responder.

### Installation
```
npm install fuse-email
```

## Initialization

#### Fuse(config)
* `config.email_key`
  * Required: yes
  * Type: `String`
  * An API Key
* `config.sending_address`
  * Required: yes
  * Type: `String`
  * A valid email for the responder to send mail from
* `config.inbound_address`
  * Required: yes
  * Type: `String`
  * A valid email for the responder to receive mail at
* `config.domain`
  * Required: yes
  * Type: `String`
  * The domain you are using to host your responder
* `config.endpoint`
  * Required: no
  * Type: `String`
  * Default: `/relay`
  * The path to send the relay webhook to  
* `config.name`
  * Required: no
  * Type: `String`
  * Default: `Sparky`
  * The name of your responder
* `config.auth_token`
  * Required: no
  * Type: `String`
  * An Authentication Token for the relay webhook to use to verify its identity
* `config.size_limit`
  * Required: no
  * Type: `String`
  * Default: `50mb`
  * The maximum post size - if you get `request entity too large` errors increase this. 
* `config.restrict_inbound`
  * Required: no
  * Type: `Boolean`
  * Default: `true`
  * Whether or not to process inbound emails that were sent to an different email address
* `config.transport`
  * Required: no
  * Type: `String`
  * Default: `sparkpost`
  * The transport to use

Next you'll need to create a Fuse instance 
```
var Fuse = require('fuse-email');

var fuse = Fuse({
  email_key: 'SPARKPOST_API_KEY',
  name: 'NAME',
  sending_address: 'robot@MY_SENDING_DOMAIN',
  inbound_address: 'robot@MY_INBOUND_DOMAIN',
  domain: 'MY_DOMAIN'
});
```


## Start Listening

#### `fuse.setupTransport(callback)`
Runs the setup for the transport. This will make sure you are setup correctly with your transport. Do not use this in production.
```
fuse.setupTransport(function() {
  // setup the server and endpoint
});
```


#### `fuse.setupServer(port, callback)`
Starts an express server at the given port. The callback is called  when the server is running.
```
fuse.setupServer(3000, function(err, server) {
  // the server is up
});
```

#### `fuse.setupEndpoint(server, callback)`
Sets up an endpoint based on `config.endpoint` to receive the data from the relay webhook from SparkPost. 
```
fuse.setupServer(3000, function(err, server) {
  fuse.setupEndpoint(server, function() {
  	// fuse is now running
  });
});
```

## The Address Object
All email addresses are in the following format
```
{
  email: 'email@example.com',
  name: 'My Name'
}
```

## Receiving Messages

### The events
Name | Description
---- | -----------
`direct_email` | The responder received an email as an original recipient
`cc_email` | The responder received an email as a cc'd recipient
`bcc_email` | The responder received an email as a bcc'd recipient
`email_received` | The responder received an email - this always fires unless there is a conversation happening

### The `inboundMessage` object
The `inboundMessage` object is returned to the event listeners.

Name | Type | Description
---- | ---- | -----------
`inboundMessage.id` | `String` | The message id of the `inboundMessage`
`inboundMessage.event` | `String` | The event that triggered the callback
`inboundMessage.to` | `Object` | The address object that received this email. *Unless `restrict_inbound` is set to `false`, the `to.email` will always be your `inbound_address`*
`inboundMessage.from` | `Object` | The address object who sent this email
`inboundMessage.subject` | `String` | The email subject
`inboundMessage.text` | `String` | The plaintext email body
`inboundMessage.html` | `String` | The html email body
`inboundMessage.recipients` | `Array[Object]` | An array of the address objects of the original recipients
`inboundMessage.cc` | `Array[Object]` | An array of the address objects of the cc'd recipients
`inboundMessage.bcc` | `Array[Object]` | An array of the address objects of the bcc'd recipients
`inboundMessage.headers` | `Object` | An object of the headers from the inbound email in a `{key: value}` format where `value` is a string if there is one value and an Array if two or more.
`inboundMessage.attachments` | `Array` | An array of attachments from the email
`inboundMessage._raw` | `*` | The original data received. For a SparkPost example look at the `relay_message` value [here](https://developers.sparkpost.com/api/relay-webhooks.html#header-example-payloads).


##### Attachments example
```
attachments = [{
    contentType: 'image/png',
    fileName: 'image.png',
    contentDisposition: 'attachment',
    contentId: '5.1321281380971@localhost',
    transferEncoding: 'base64',
    length: 126,
    generatedFileName: 'image.png',
    checksum: 'e4cef4c6e26037bcf8166905207ea09b',
    content: <Buffer ...>
}];
```

### Registering Event Listeners
There are two methods for receiving messages: `on` and `hear`. Both of these functions take a callback. These callbacks are given a `responder` object and a `inboundMessage` object.

#### `fuse.on(events, callback)`
To stop all subsequent listeners, return `false` 

Name | Type | Description
---- | ---- | -----------
`events` | `String` or `Array` | A comma delaminated list or an array of events on which to run this function
`callback` | `Function` | The function to be called when any of the given events take place

Example:
```
fuse.on('email_received', function(responder, inboundMessage) {
  responder.send({
    subject: 'Hello World',
    body: 'What a nice day we are having!'
  });
});
```


#### `fuse.hears(patterns, events, callback)`
*If a message matches a `hears` listener all subsequent listeners are ignored.*

The `hears` function works just like the `on` function except it takes an extra parameter, `patterns`. This parameter can be either an array or object. If it's an array then the patterns are checked against the subject and body. If it's an object then it can have a `subject` and/or `body` property, each of which should be an array of patterns to check against. All the patterns should either be Regular Expressions or strings.

Example:
```
fuse.hears({
  subject: ['hello', 'hi'],
  body: ['howdy', 'sup'],
}, 'direct_email', function(responder, inboundMessage) {
  responder.send({
    subject: 'Hello there',
    body: 'Hello to you too!'
  });
});
```

## Sending Messages

### The `responder` object
The `responder` object drives responding to messages. It is returned to all event listeners.
You can create a standalone responder to send something or start a conversation by calling the `responder` method.

```
var responder = fuse.responder();
```
Keep in mind that the `reply` and `startPrivateConversation` methods will not work as they are reactions to inbound messages.

### The `outboundMessage` object
Name | Type | Description
---- | ---- | -----------
`message.subject` | `String` | The subject of the email.
`message.body` or `message.html` | `String` | The body of the email.
`message.text` | `String` | If this is not given then it will be generated from the html.
`message.headers` | `Object` | Email headers other than “Subject”, “From”, “To”, and “Reply-To”
`message.recipients` | `Array[Object]` | An array of email addresses.
`message.cc` | `Array[Object]` |  An array of email addresses to receive a carbon copy.
`message.bcc` | `Array[Object]` |  An array of email addresses to receive a blind carbon copy.
`message.substitution_data` | `String` | Any substitution data for the email.
`message.attachments` | `Array` | An array of attachments to send with the email. See the [SparkPost docs](https://developers.sparkpost.com/api/transmissions.html#header-attachment-attributes) for more details.
`message.from` | `Object` | An address object to override `config.name` and `config.sending_address` for this message.
`message.reply_to` | `Object` | An address object to override `config.name` and `config.inbound_address` for this message.

#### `responder.send(outboundMessage)`
This will send send a new email with the given content. If recipients of any type are given the recipients and cc will default to the values from the received email.

```
fuse.on('direct_email', function(responder, inboundMessage) {
  responder.send({
    subject: 'Hello World',
    body: '<h2>What a nice {{time}} we are having!</h2>',
    substitution_data: {
    	time: 'day'
    }
  });
});
```

#### `responder.reply(outboundMessage)`

This method is identical to the `send` method except it will reply to the sent message. As such you can not set the `subject`, `recipients`, or `cc`.

```
fuse.on('email_received', function(responder, inboundMessage) {
  responder.reply({
    body: 'I got your message!'
  });
});
```


## Having Conversations

The responder has two methods for starting conversations.

#### `responder.startConversation(config, callback)`
Starts a conversation with everyone from the received message or the specified `recipients` and `cc` recipients.

Name | Type | Required | Description
---- | ---- | -------- | -----------
`config` | `String` or `Object` | yes | If this is a string then it is the subject of the conversation.
`config.subject` | `String` | yes | The subject for the new thread of messages for this conversation. This is required.
`config.recipients` | `Array[Object]` | no |  An array of address objects. This will default to the recipients of the `inboundMessage` that was returned with this responder. This is required if starting a conversation from a standalone responder.
`config.cc` | `Array[Object]` | no |  An array of address objects to receive a carbon copy. This will default to the cc'd recipients of the `inboundMessage` that was returned with this responder.
`config.timeout_after` | `Number` | no | Milliseconds to wait before the conversation times out. Defaults to `600000`. (10 minutes).


#### `responder.startPrivateConversation(topic, callback)`
Starts a conversation with the person who sent the `inboundMessage`. This can not be used from a standalone responder.

### the `convo` object
When a conversation is started it the callback receives a convo object.

#### `convo.send(outboundMessage)`
This works just like the `reply` method of the `responder` object. It will send the message to all the participants of this conversation.

#### `convo.ask(outboundMessage, handler)`
Name | Type | Description
---- | ---- | -----------
message | `Object` | See the [outboundMessage options](#the-outboundmessage-object)
handler | `Function` | This will be called when someone replies to the question.

The handler function will receive a `message` object and the same `convo` object to continue the conversation.

```
// from event listener
responder.startConversation('Tell me about yourself!', function(convo) {
  convo.ask({
    body: 'What\'s your name?'
  }, function(convo, inboundMessage) {
  
    let name = sparky.clean(sparky.getLatest(inboundMessage));

    convo.send({
      body: 'Nice to meet you, {{name}}',
      substitution_data: {
        name: name
      }
    });

  });

}); 
```

#### `convo.wait()`
This function keeps the conversation alive while preforming asynchronous tasks until you can ask a question. See an example [here](/tree/master/examples/async-wait.js).


#### `convo.end()`
Call this function to force the conversation to end.

## Util functions
These are a few functions to make your life easier.

#### `fuse.clean(str)`
Returns the given string stripped of any html tags, trailing spaces, and line breaks.

#### `fuse.getLatest(message)`
Returns the latest text message from an email thread.