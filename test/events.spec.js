const chai = require('chai');
const expect = chai.expect;
var sinon = require("sinon");
var chaiSinon = require("chai-sinon");
const EventsContext = require('../lib/events');
const _ = require('lodash');
chai.use(chaiSinon);

describe('Event Context', function() {  
  it('should be a contructor', function() {
    expect(EventsContext).to.be.a('function');
  });

  it('should return an object with the given functions', function() {
    var context = EventsContext();

    expect(context).to.be.an('object');
    expect(context).to.contain.all.keys('on', 'hears', 'hearTest', 'trigger', 'unset');
  });

  it('should restore the hear test and events', function() {
    var context = EventsContext();

    context.on('one', function() {});
    context.on('two', function() {});
    context.on('three', function() {});
    context.hearTest = function() {};

    context.reset();

    expect(context._events).to.not.have.keys;
    expect(context.hearTest).to.equal(context._defaultHearTest);
  });

  describe('on function', function() {
    it('should add an event and a listner', function() {
      var context = EventsContext();

      var key = context.on('my_event', function() { /* I get called on my_event */ });

      expect(context._events).to.contain.key('my_event');
      expect(context._events.my_event).to.contain.key(key);
    });

    it('should add multiple events and listners', function() {
      var context = EventsContext();

      var key = context.on('my_event,my_other_event', function() { /* I get called on my_event and my_other_event */ });

      console.log(context);

      expect(context._events).to.contain.key('my_event');
      expect(context._events.my_event).to.contain.key(key);
      expect(context._events).to.contain.key('my_other_event');
      expect(context._events.my_event).to.contain.key(key);
    });
  });

  describe('once function', function() {
    it('should add a one time listener', function() {
      var context = EventsContext();

      context.on('my_event', function() { /* I get called on my_event */ });
      var key = context.once('my_event', function() { /* I get called once on my_event */ });

      expect(context._events.my_event).to.contain.key(key);

      context.trigger('my_event');

      expect(context._events.my_event).to.not.contain.key(key);
    });
  });

  describe('hears function', function() {
    it('should call the given callback when the pattern matches', function() {
      var context = EventsContext();

      var callback = sinon.spy();

      context.hears('lo', 'my_event', callback);

      context.trigger('my_event', ['hello']);

      expect(callback).to.have.been.calledWith('hello');
    });

    it('should not call the given callback when the pattern fails to match', function() {
      var context = EventsContext();

      var callback = sinon.spy();

      context.hears('low', 'my_event', callback);

      context.trigger('my_event', ['hello']);

      expect(callback).to.not.have.been.called;
    });

    it('should not call the any other callbacks when the pattern matches', function() {
      var context = EventsContext();

      var regularCallback = sinon.spy();

      context.hears('lo', 'my_event', function() {});
      context.on('my_event', regularCallback);

      context.trigger('my_event', ['hello']);

      expect(regularCallback).to.not.have.been.called;
    });

    it('should throw an error on a bad pattern', function() {
      var context = EventsContext();

      expect(context.hears.bind(null, ['+', 'my_event', function() {}])).to.throw(Error);
    });

    it('should pass through non-string patterns', function() {
      var context = EventsContext();

      var id = context.hears({}, 'my_event', function() {});

      expect(id).to.be.a('string');
    });
  });

  describe('hearTest function', function() {

    describe('default test', function() {
      it('should return true when the pattern matches', function() {
        var context = EventsContext();

        expect(context.hearTest([/lo/i], ['hello world'])).to.be.true;
      });

      it('should return false when the pattern does not match', function() {
        var context = EventsContext();

        expect(context.hearTest([/low/i], ['hello world'])).to.be.false;
      });

      it('should return true when any of the patterns match', function() {
        var context = EventsContext();

        expect(context.hearTest([/low/i,/[aeiou]/i], ['hello world'])).to.be.true;
      });
    });

    describe('custom test', function() {
      it('should return true when the pattern matches', function() {
        var context = EventsContext();

        context.hearTest = function(patterns, params) {
          let matchFirst = _.filter(patterns, (pattern) => { return params[0].match(pattern); }).length > 0;
          let matchSecond = _.filter(patterns, (pattern) => { return params[1].match(pattern); }).length > 0;

          return matchFirst && matchSecond;
        };

        expect(context.hearTest([/ball/i], ['baseball', 'football'])).to.be.true;
      });

      it('should return false when the pattern does not match', function() {
        var context = EventsContext();

        context.hearTest = function(patterns, params) {
          let matchFirst = _.filter(patterns, (pattern) => { return params[0].match(pattern); }).length > 0;
          let matchSecond = _.filter(patterns, (pattern) => { return params[1].match(pattern); }).length > 0;

          return matchFirst && matchSecond;
        };

        expect(context.hearTest([/ball/i], ['soccer', 'basketball'])).to.be.false;
      });
    });
  });

  describe('trigger function', function() {
    it('should trigger non-existent event', function() {
      var context = EventsContext();

      expect(context.trigger('no_event')).to.be.false;
    });

    it('should trigger all functions in event', function() {
      var context = EventsContext();

      var firstCallback = sinon.spy();
      var secondCallback = sinon.spy();

      context.on('my_event', firstCallback);
      context.on('my_event', secondCallback);

      context.trigger('my_event', ['param']);

      expect(firstCallback).to.have.been.calledWith('param');
      expect(secondCallback).to.have.been.calledWith('param');
    });
  });

  describe('unset function', function() {
    it('should remove a listener', function() {
      var context = EventsContext();

      // add two callbacks
      context.on('my_event', function() {});
      var key = context.on('my_event', function() {});

      expect(context._events.my_event).to.contain.key(key);

      context.unset('my_event', key);

      expect(context._events.my_event).to.not.contain.key(key);
    });

    it('should remove an event', function() {
      var context = EventsContext();

      var key = context.on('my_event', function() {});

      expect(context._events).to.contain.key('my_event');

      context.unset('my_event');

      expect(context._events).to.not.contain.key('my_event');
    });

    it('should remove a listener and event when removing the last listener', function() {
      var context = EventsContext();

      var key = context.on('my_event', function() {});

      expect(context._events.my_event).to.contain.key(key);

      context.unset('my_event', key);

      expect(context._events).to.not.contain.key('my_event');
    });

    it('should remove a non-existent event', function() {
      var context = EventsContext();

      expect(context.unset('my_event')).to.be.false;
    });

    it('should remove a non-existent listener', function() {
      var context = EventsContext();

      expect(context.unset('my_event', '1')).to.be.false;
    });

        it('should remove a non-existent listener from registered event', function() {
      var context = EventsContext();

      context.on('my_event', function() {});

      expect(context.unset('my_event', '1')).to.be.false;
    });
  });

});