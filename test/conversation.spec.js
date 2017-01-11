'use strict';

const proxyquire = require('proxyquire');
const chai = require('chai');
const expect = chai.expect;
const sinon = require("sinon");
const loggerSpy = sinon.spy();
const Conversation = require('../lib/conversation.js');
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

describe('Conversation', function() {
  it('should be a contructor', function() {
    expect(Conversation).to.be.a('function');
  });

  it('should return an object with the given functions', function() {
    let fuse = Fuse(baseConfig);
    let convo = Conversation(fuse, {}, function() {});

    expect(convo).to.be.an('object');
    expect(convo).to.contain.all.keys('start', 'handle', 'end', 'timeout', 'send', 'ask', 'wait', 'hasMessages', 'isActive');
  });

  describe('start function', function() {
    it('should start successfully', function() {
      let activationCallback = sinon.spy();
      let fuse = Fuse(baseConfig);
      let convo = Conversation(fuse, {}, activationCallback);

      expect(convo.status).to.equal('sitting');
      expect(convo.timeout_function).to.be.null;

      convo.handler = function() {};

      convo.start();
      
      expect(convo.timeout_function).to.be.an('object');
      expect(convo.isActive()).to.be.true;
      expect(activationCallback).to.have.been.calledWith(convo);
    });

    it('should start and immediately end with no handler', function() {
      let activationCallback = sinon.spy();
      let fuse = Fuse(baseConfig);
      let convo = Conversation(fuse, {}, activationCallback);

      expect(convo.status).to.equal('sitting');
      expect(convo.timeout_function).to.be.null;

      convo.start();
      
      expect(convo.isActive()).to.be.false;
      expect(convo.status).to.equal('finished');
      expect(activationCallback).to.have.been.calledWith(convo);
    });
  });

  it('should timeout when given no messages after the allotted time', function() {
    let timeout = 5;
    let fuse = Fuse(baseConfig);
    let convo = Conversation(fuse, {
      timeout_after: timeout
    }, function(convo) {
      convo.ask({
        body: 'wat up?'
      }, function() {

      });
    });

      expect(convo.timeout_function).to.be.null;

      convo.start();
      
      setTimeout(function() {
        expect(convo.timeout_function).to.be.an('object');
        expect(convo.status).to.equal('timeout');
        expect(convo.isActive()).to.be.false;
      }, timeout);
  });

  describe('send function', function() {
    let fuse = Fuse(baseConfig);
    let convo = Conversation(fuse, {}, function() {});
  });
})