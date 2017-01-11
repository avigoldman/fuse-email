'use strict';

const proxyquire = require('proxyquire');
const chai = require('chai');
const expect = chai.expect;
const sinon = require("sinon");
const loggerSpy = sinon.spy();
const Fuse = proxyquire('../lib/index.js', {
  './logger': function() {
    return {
      debug: loggerSpy,
      verbose: loggerSpy
    }
  }
});
const _ = require('lodash');
chai.use(require('sinon-chai'));

const baseConfig = {
  email_key: 'sparkpost_key',
  name: 'Robot', 
  address: 'robot@sendmailfor.me',
  domain: 'http://mydomain.com',
  setup: false,
  transport: 'transport'
};

describe('Fuse', function() {
  it('should be a contructor', function() {
    expect(Fuse).to.be.a('function');
  });

  it('should return an object with the given functions', function() {
    let fuse = Fuse(baseConfig);

    expect(fuse).to.be.an('object');
    expect(fuse).to.contain.all.keys('setupServer', 'setupEndpoint', 'receive', 'handle', 'responder');
  });

  describe('config', function() {
    it('should fill in all the default values', function() {
      var fuse = Fuse(baseConfig);

      expect(fuse.config).to.contain.all.keys('name', 'endpoint', 'convos', 'sending_address', 'inbound_address');
    });

    it('should run setup when setup is true', function() {
      var fuse = Fuse(_.defaults({
        setup: true
      }, baseConfig));

      expect(fuse.transport.ran_setup).to.be.true;
    });
  });

  it('should call the handle function for each received message', function() {
    let fuse = Fuse(baseConfig);

    let handleFunction = sinon.spy(fuse, 'handle');

    fuse.receive([
      {
        text: 'hello world'
      },
      {
        text: 'goodbye for now'
      }
    ]);

    expect(handleFunction).to.have.been.calledTwice;
  });

  describe('handle function', function() {
    it('should stop if the given address is invalid and restrict_inbound is true', function() {
      let fuse = Fuse(baseConfig);

      let findConvoSpy = sinon.spy(fuse.transport, 'findConversation');

      fuse.handle({
        html: '<h1>hello world</h1>',
        text: 'hello world',
        to: 'not_valid@example.com'
      });

      expect(findConvoSpy).to.not.have.been.called;
    });

    it('should try to find the converation and pass it off to the convo handler', function() {
      let fuse = Fuse(baseConfig);

      let inboundMessage = {
        html: '<h1>hello world</h1>',
        text: 'hello world',
        to: baseConfig.address
      };

      let findConvoStub = sinon.stub(fuse.transport, 'findConversation');
      let convoHandleSpy = sinon.spy();

      findConvoStub.withArgs(inboundMessage).returns({
        handle: convoHandleSpy
      });

      fuse.handle(inboundMessage);

      expect(findConvoStub).to.have.been.calledOnce;
      expect(convoHandleSpy).to.have.been.calledOnce;
    });

    it('should pass through messages not sent to the inbound address when restrict_inbound is false', function() {
      let fuse = Fuse(_.defaults({
        restrict_inbound: false
      }, baseConfig));

      let triggerSpy = sinon.spy(fuse, 'trigger');

      let inboundMessage = {
        to: 'me@sendmailfor.me',
        recipients: ['me@sendmailfor.me'],
        cc: [],
        bcc: [],
      };

      fuse.handle(inboundMessage);

      expect(triggerSpy).to.have.been.calledWith('direct_email');
      expect(triggerSpy).to.have.been.calledWith('email_received');
    });

    it('should trigger direct_email and email_received', function() {
      let fuse = Fuse(baseConfig);

      let triggerSpy = sinon.spy(fuse, 'trigger');

      let inboundMessage = {
        to: baseConfig.address,
        recipients: [baseConfig.address],
        cc: [],
        bcc: [],
      };

      fuse.handle(inboundMessage);

      expect(triggerSpy).to.have.been.calledWith('direct_email');
      expect(triggerSpy).to.have.been.calledWith('email_received');
    });

    it('should trigger cc_email and email_received', function() {
      let fuse = Fuse(baseConfig);

      let triggerSpy = sinon.spy(fuse, 'trigger');

      let inboundMessage = {
        to: baseConfig.address,
        recipients: [],
        cc: [baseConfig.address],
        bcc: [],
      };

      fuse.handle(inboundMessage);

      expect(triggerSpy).to.have.been.calledWith('cc_email');
      expect(triggerSpy).to.have.been.calledWith('email_received');
    });

    it('should trigger bcc_email and email_received', function() {
      let fuse = Fuse(baseConfig);

      let triggerSpy = sinon.spy(fuse, 'trigger');

      let inboundMessage = {
        to: baseConfig.address,
        recipients: [],
        cc: [],
        bcc: [baseConfig.address],
      };

      fuse.handle(inboundMessage);

      expect(triggerSpy).to.have.been.calledWith('bcc_email');
      expect(triggerSpy).to.have.been.calledWith('email_received');
    });
  });

  // describe('server', function() {
  //   it('should start', function() {

  //   });

  //   it('should get an endpoint', function() {
  //     let fuse = Fuse(baseConfig);

  //     let server = {
  //       post: sinon.stub()
  //     };

  //     let callback = sinon.spy();

  //     fuse.setupEndpoint(server, callback);

  //     expect(callback).to.be.calledOnce;
  //   });
  // });
});