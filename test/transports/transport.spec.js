'use strict';

const chai = require('chai');
const expect = chai.expect;
const sinon = require("sinon");
const loggerSpy = sinon.spy();
const logger = { debug: loggerSpy, verbose: loggerSpy };
const Transport = require('../../lib/transports/transport.js');
const _ = require('lodash');
chai.use(require('sinon-chai'));

describe('Transport', function() {
  it('should merge with extension', function() {
    let transport = Transport({}, {
      extra: 'thing'
    });

    expect(transport).to.contain.key('extra');
  });

  it('should have setup function', function() {
    let transport = Transport({});

    expect(transport.ran_setup).to.be.undefined;
    transport.setup();
    expect(transport.ran_setup).to.be.true;
  });

  it('should validate request', function() {
    let transport = Transport({});

    expect(transport.validate()).to.be.false;
    expect(transport.validate('some request')).to.be.true;
  });

  it('should parse the body and call the callback with an array of inboundMessage objects', function() {
    let transport = Transport({});

    var body = {
      'give': 'me back'
    };

    transport.parse(body, function(inboundMessages) {
      expect(inboundMessages).to.be.an('Array');
      expect(inboundMessages[0]).to.be.an('Object');  
    });

    
  });

  describe('findConversation', function() {
    var exampleConvo = {
      id: '123@sendmailfor.me',
    };

    it('should fail to find the convo when there are no convos', function() {
      let transport = Transport({logger});

      let convo = transport.findConversation({
        headers: {
          references: `<conversation-id_notme@address.com}>`
        }
      }, []);

      expect(convo).to.be.false;
    });

    it('should fail to find the convo when there are no reference header', function() {
      let transport = Transport({logger});

      let convo = transport.findConversation({
        headers: {}
      }, []);

      expect(convo).to.be.false;
    });

    it('should fail to find the convo when there is no referenced convo ids', function() {
      let transport = Transport({logger});

      let convo = transport.findConversation({
        headers: {
          references: '<some_other_message_id@address.com}>'
        }
      }, []);

      expect(convo).to.be.false;
    });

    it('should failed to find the convo when the inboundMessage is in reply to a convo that doesn\'t exist', function() {
      let transport = Transport({logger});

      let convo = transport.findConversation({
        headers: {
          references: `<conversation-id_notme@address.com}>`
        }
      }, [ exampleConvo ]);

      expect(convo).to.be.false;
    });

    it('should find the convo when the inboundMessage is in reply to a previous message in the the convo', function() {
      let transport = Transport({logger});

      let convo = transport.findConversation({
        headers: {
          references: `<conversation-id_${exampleConvo.id}>`
        }
      }, [ exampleConvo ]);

      expect(convo).to.equal(exampleConvo);
    });
  });

  it('send function should call the callback once', function() {
    let transport = Transport({});

    let callback = sinon.spy();

    let outboundMessage = {'outbound': 'message'};

    transport.send({}, outboundMessage, callback)

    expect(callback).to.be.calledWith(null, true);
  });
});