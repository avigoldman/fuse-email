'use strict';

const Fuse = require('../lib/');
const port = process.env.PORT || 3000;

const fuse = Fuse({
  email_key: YOUR_SPARKPOST_KEY,
  domain: YOUR_DOMAIN,
  name: 'Robot', 
  sending_address: 'robot@sendmailfor.me',
  inbound_address: 'robot@sendmailfor.me'
});

fuse.setupTransport(function() {
  fuse.setupServer(port, function(err, server) {
    fuse.setupEndpoint(server);
  });
});

fuse.hears(['hello', 'hi', 'howdy', 'hey'], 'email_received', function(responder, inboundMessage) {
  responder.startPrivateConversation('Tell me about yourself.', whatIsYourName);
});

function whatIsYourName(convo) {
  convo.ask({
    body: 'What\'s your name?',
  }, howOldAreYou);
}

function howOldAreYou(convo, inboundMessage) {
  convo.ask({
    body: 'Nice to meet you, {{name}}. <br>How old are you?',
    substitution_data: {
      name: fuse.clean(fuse.getLatest(inboundMessage))
    }
  }, canYouVote);
}

function canYouVote(convo, inboundMessage) {
  let age = parseInt(fuse.clean(fuse.getLatest(inboundMessage)));
  let body = `{{if years_till_18 > 0}}
              Looks like you can\'t vote yet. Only {{years_till_18}} to go!
              {{else}}
              Congratulations, you can vote!
              {{end}}`;
              
  convo.send({
    html: body,
    text: body,
    substitution_data: {
      years_till_18: 18 - age
    }
  });
}