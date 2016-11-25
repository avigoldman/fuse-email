var Sparky = require('./lib/bot.js');

var sparky = Sparky({
  email_key: '056cf4213c89156180708f57e3a38bed59451563',
  bot_name: 'robot',
  sending_address: 'robot@sendmailfor.me',
  inbound_address: 'robot@sendmailfor.me',
  // sending_address and inbound_address can extend from address: 'robot@aymlab.com',
  domain: 'https://infinite-springs-29395.herokuapp.com',
});

// Events
// direct_email - email sent directly to the bot
// cc_email - email was sent with the bot cc'ed
// bcc_email - email was send with the bot bcc'ed
// mention - the bot's name was said in an email
// direct_mention - the bot's sending/inbound address was said in an email
// email_received - an email of anytype was send to the bot

// Bot
// say - sends a new email
// reply - sends a response email to the given message
// startConversation - starts a conversation
// 

sparky.on('direct_email', function(bot, message) {
  console.log('direct mail!');
});

sparky.on('mention', function(bot, message) {
  bot.say({
    'subject': 'Did someone say my name?',
    'body': 'Yes you did!',
  });
});


sparky.on('email_received', function(bot, message) {
  // bot.say({
  //   'subject': 'hello back to you!',
  //   'body': '<h1>Say there</h1>',
  // });
});


sparky.setupServer(process.env.PORT || 3000, function(err, server) {
  sparky.setupEndpoint(server, function() {
    // sparky.processMessage({
    //   "content": {
    //     "headers": [],
    //     "html": "<p>robot Hi there <strong>SparkPostians</strong>.</p>",
    //     "subject": "We come in peace",
    //     "text": "robot Hi there SparkPostians.",
    //     "to": [
    //       "robot@aymlab.com"
    //     ]
    //   },
    //   "msg_from": "avigoldmankid@gmail.com",
    //   "rcpt_to": "robot@aymlab.com",
    // });
  });
});