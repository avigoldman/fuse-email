# Email Bot Framework
### A framework for writing email bots using SparkPost

[SparkPost](https://sparkpost.com) is a cloud email service that allows developers to send and receive emails.

This is a botkit-inspired framework written around the SparkPost API to make it easy to create email bots.

##### Table of Contents
[Getting Started](#getting-started)<br>
[Initialization](#initialization)<br>
[Start Listening](#start-listening)<br>
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
The sending domain is the domain that your bot will send emails from (.e.g. my_robot@my_sending_domain.com).

Add your domain in the [Sending Domains](https://app.sparkpost.com/account/sending-domains) section. You'll need to verify ownership of the domain through the methods provided in the UI. 

### Configuring your inbound domain

Your inbound domain is the domain at which your bot will receive emails. It can be the same address as your sending domain. If you use any email address at that domain then you should use a subdomain of your sending domain or a different domain entirely. Otherwise your bot will get all your emails. 

Add the following MX records to your inbound domain's DNS

Name | Type | Data | Priority
---- | ---- | ---- | --------
`your.inbounddomain.com` | MX | rx1.sparkpostmail.com | 10
`your.inbounddomain.com` | MX | rx2.sparkpostmail.com | 10
`your.inbounddomain.com` | MX | rx3.sparkpostmail.com | 10


## Setting up the bot
Once the DNS changes have propagated (you can check using the [mxtoolbox](https://mxtoolbox.com/)), its time to build your bot.

### Installation
```
npm install thename
```

## Initialization

#### EmailBot(config)
* `config.email_key`
  * Required: yes
  * Type: `String`
  * A SparkPost API Key
* `config.sending_address`
  * Required: yes
  * Type: `String`
  * A valid email for the bot to send mail from
* `config.inbound_domain`
  * Required: yes
  * Type: `String`
  * A valid email for the bot to receive mail at
* `config.domain`
  * Required: yes
  * Type: `String`
  * The domain you are using to host your bot
* `config.endpoint`
  * Required: no
  * Type: `String`
  * Default: `/relay`
  * The path to send the relay webhook to  
* `config.bot_name`
  * Required: no
  * Type: `String`
  * Default: `Sparky`
  * The name of your bot
* `config.auth_token`
  * Required: no
  * Type: `String`
  * An Authentication Token for SparkPost for the relay webhook to use to verify its identity
* `config.restrict_inbound`
  * Required: no
  * Type: `Boolean`
  * Default: `true`
  * Whether or not to process inbound emails that were sent to an different email address
* `config.setup`
  * Required: no
  * Type: `Boolean`
  * Default: `true`
  * Whether or not to run the SparkPost setup which verifies/adds your sending domain/inbound domain/and relay webhook. *Should be turned off in production.*
* `config.debug_mode`
  * Required: no
  * Type: `Boolean`
  * Default: `false`
  * Toggles if the bot will send emails


Next you'll need to create an instance of the bot 
```
var EmailBot = require('thename');

var sparky = EmailBot({
    email_key: 'SPARKPOST_API_KEY',
    bot_name: 'MY_BOT_NAME',
    sending_address: 'robot@MY_SENDING_DOMAIN',
    inbound_address: 'robot@MY_INBOUND_DOMAIN',
    domain: 'MY_DOMAIN'
  });
```


## Start Listening

#### `sparky.setupServer(port, callback)`
Starts an express server at the given port. The callback is called  when the server is running.
```
sparky.setupServer(3000, function(err, server) {
  // the server is up
});
```

#### `sparky.setupEndpoint(server, callback)`
Sets up an endpoint based on `config.endpoint` to receive the data from the relay webhook from SparkPost. 
```
sparky.setupServer(3000, function(err, server) {
  sparky.setupEndpoint(server, function() {
  	// the bot is now running
  });
});
```

## Receiving Messages

### The events
Name | Description
---- | -----------
`direct_email` | The bot received an email as an original recipient
`cc_email` | The bot received an email as a cc'd recipient
`bcc_email` | The bot received an email as a bcc'd recipient
`email_received` | The bot received an email - this always fires unless there is a conversation happening

### The `message` object
The message object is returned to the event listeners.

Name | Type | Description
---- | ---- | -----------
`message.event` | `String` | The event that triggered the callback
`message.to` | `String` | The address that received this email. *Unless `restrict_inbound` is set to `false`, this will always be your `inbound_address`*
`message.from` | `String` | The address who sent this email
`message.subject` | `String` | The email subject
`message.text` | `String` | The plaintext email body
`message.html` | `String` | The html email body
`message.recipients` | `Array` | An array of the email addresses of the original recipients
`message.cc` | `Array` | An array of the email addresses of the cc'd recipients 
`message._raw` | `Object` | The original message sent by SparkPost. For an example look [here](https://developers.sparkpost.com/api/relay-webhooks.html#header-example-payloads) at the `relay_message`


### Registering Event Listeners
There are two methods for receiving messages: `on` and `hear`. Both of these functions take a callback to be called. These callbacks are given a `bot` object and a `message` object.

#### `sparky.on(events, callback)`
To stop all subsequent listeners, return `false` 

Name | Type | Description
---- | ---- | -----------
`events` | `String` or `Array` | A comma delaminated list or an array of events to on which to run this function
`callback` | `Function` | The function to be called when any of the given events takes place

Example:
```
sparky.on('email_received', function(bot, message) {
  bot.say({
    subject: 'Hello World',
    body: 'What a nice day we are having!'
  });
});
```


#### `sparky.hears(patterns, events, callback)`
*If a message matches a `hears` listener all subsequent listeners are ignored.*

The `hears` function works just like the `on` function except it takes an extra parameter, `patterns`. This parameter can be either an array or object. If it's an array then the bot checks if either the subject or the body matches any of the given patterns. If it's an object then it can have a `subject` and/or `body` property, each of which should be an array of patterns to check against. All the patterns should either be Regular Expressions or strings.

Example:
```
sparky.hears({
  subject: ['hello', 'hi'],
  body: ['howdy', 'sup'],
}, 'direct_email', function(bot, message) {
  bot.say({
    subject: 'Hello there',
    body: 'Hello to you too!'
  });
});
```

## Sending Messages

### The `bot` object
The `bot` object drives responding to messages. It is returned to all event listeners.
You can create a standalone bot to say something or start a conversation by calling the `bot` method.

```
var bot = sparky.bot();
```
Keep in mind that the `reply` and `startPrivateConversation` methods will not work as they are reactions to received messages.

#### `bot.say(message)`
This will send send a new email with the given content or template. If none are given, the recipients, cc, and bcc will default to the values from the received email.

```
bot.say({
  subject: 'Hello World',
  body: '<h2>What a nice {{time}} we are having!</h2>',
  text: 'What a nice {{time}} we are having!',
  substitution_data: {
  	time: 'day'
  }
});
```

##### Message options
Name | Type | Description
---- | ---- | -----------
`message.subject` | `String` | The subject of the email. The message must have a subject, body or template at minimum.
`message.body` or `message.html` | `String` | The body of the email. The message must have a subject, body or template at minimum.
`message.text` | `String` | If this is not given then it will be generated from the html
`message.headers` | `Object` | Email headers other than “Subject”, “From”, “To”, and “Reply-To”
`message.recipients` | `Array` | An array of SparkPost-formatted recipients. [SparkPost recipient format.](https://developers.sparkpost.com/api/recipient-lists.html#header-recipient-attributes)
`message.cc` | `Array` |  An array of SparkPost-formatted recipients to receive a carbon copy.
`message.bcc` | `Array` |  An array of SparkPost-formatted recipients to receive a blind carbon copy.
`message.template_id` | `String` | The SparkPost template to use. This is used instead of the subject, body, text, and headers. *This does not work with `reply` or conversations*
`message.substitution_data` | `String` | Any substitution data for the email.
`message.attachments` | `Array` | An array of attachments to send with the email. See the [SparkPost docs](https://developers.sparkpost.com/api/transmissions.html#header-attachment-attributes) for more details.
`message.from` | `String` | Overrides the sending_address for this message.
`message.reply_to` | `String` | Overrides the inbound_address for this message.

#### `bot.reply(receivedMessage, yourMessage)`

This method is identical to the `say` method except it will reply to the sent message. As such you can not set the `subject`, `recipients`, or `cc`.

```
sparky.on('email_received', function(bot, message) {
  
  bot.reply(message, {
    body: 'I got your message!'
  });

});
```


## Having Conversations

The bot has two methods for starting a conversation.

#### `bot.startConversation(config, callback)`
Starts a conversation with everyone from the received message or the specified `recipients` and `cc` recipients.

Name | Type | Required | Description
---- | ---- | -------- | -----------
`config` | `String` or `Object` | yes | If this is a string then it is the topic of the conversation.
`config.topic` | `String` | yes | The subject for the new thread of messages for this conversation. This is required.
`config.recipients` | `Array` | yes |  An array of SparkPost-formatted recipients. This will default to the recipients of the message that returned this bot.
`config.cc` | `Array` | no |  An array of SparkPost-formatted recipients to receive a carbon copy. This will default to the cc'd recipients of the message that returned this bot.


#### `bot.startPrivateConversation(topic, callback)`
Starts a conversation with the person who sent the message.


### the `convo` object
When a conversation is started it the callback receives a convo object.

#### `convo.say(message)`
This works just like the `reply` method of the `bot` object. It will send the message to all the participants of this conversation.

#### `convo.ask(message, handler)`
Name | Type | Description
---- | ---- | -----------
message | `Object` | See the [message options](#message-options)
handler | `Function` | This will be called when someone replies to the question.

The handler function will receive a `message` object and the same `convo` object to continue the conversation.

```
bot.startConversation('Tell me about yourself!', function(convo) {

  convo.ask({
    body: 'What\'s your name?'
  }, function(convo, response) {
  
    let name = sparky.clean(sparky.getLatest(response));

    convo.say({
      body: 'Nice to meet you, {{name}}',
      substitution_data: {
        name: name
      }
    });

    convo.end();

  });

}); 
```

#### `convo.end()`
Call this function to end the conversation.


## Helper functions
These are a few functions to make your life easier.

#### `sparky.clean(str)`
Returns the given string stripped of any html tags, trailing spaces, and line breaks.

#### `sparky.getLatest(message)`
Returns the latest text message from an email thread.
