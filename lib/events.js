'use strict';

const STOP_TRIGGER = false;
const uniqid = require('uniqid');
const _ = require('lodash');

function EventsContext() {
  const context = {
    _events: {}
  };

  /**
   * registers a listener on the given events
   */
  context.on = function(event, listener) {
    var events = toArray(event);

    let id = uniqid();

    _.each(events, (event) => {
      addListener(id, event, listener);
    });

    return id;
  };

  /**
   * registers a listener to be called once
   */
  context.once = function(event, listener) {
    let id = uniqid();

    addListener(id, event, function() {
      context.unset(event, id);

      listener.apply(listener, arguments);
    });

    return id;
  };

  /**
   * Registers a listener on the given event and pattern set
   * 
   * If one of these listeners is triggered no following listeners are
   */
  context.hears = function(pattern, events, listener) {
    var patterns = toArray(pattern);

    patterns = _.map(patterns, generateTest);

    return context.on(events, function() {
      if (context.hearTest(patterns, arguments)) {
        listener.apply(context, arguments);

        return STOP_TRIGGER;
      }
    });
  };

  context._defaultHearTest = function(patterns, params) {
    var testString = params[0];

    return _.filter(patterns, (pattern) => { return testString.match(pattern); }).length > 0;
  };

  context.hearTest = context._defaultHearTest;

  context.reset = function() {
    context._events = {};
    context.hearTest = context._defaultHearTest;
  };

  /**
   * triggers the given event with the specified params
   */
  context.trigger = function(event, params) {
    if (hasListeners(event)) {
      _.each(getListeners(event), (listener) => {
        return listener.apply(listener, params);
      });

      return true;
    }

    return false;
  };

  /**
   * deletes an specific listener or all the listeners in an event if no id is given
   */
  context.unset = function(event, id) {
    if (_.isUndefined(id)) {
      return deleteEvent(event);
    }
    else {
      return deleteListener(event, id);
    }
  }



  /**
   * returns boolean on if there are listeners for the given event
   */
  function hasListeners(event) {
    return !!getListeners(event);
  };

  /**
   * returns the listners for the given events
   */
  function getListeners(event) {
    return context._events[event];
  };

  /**
   * returns the listener with the given id
   */
  function getListener(event, id) {
    if (hasListeners(event)) {
      var listeners = getListeners(event);

      if (_.has(listeners, id)) {
        return listeners[id];
      }
    }

    return false;
  };

  /**
   * returns boolean on if the listener id for the event exists
   */
  function hasListener(event, id) {
    return !!getListener(event, id);
  }

  /**
   * adds a listener to an event
   */
  function addListener(id, event, listener) {
    if (!hasListeners(event)) {
      context._events[event] = {};
    }
    
    context._events[event][id] = listener;

    return id;
  };

  /*
   * remove a listener with the given id from an event
   */
  function deleteListener(event, id) {
    if (hasListener(event, id)) {
      delete context._events[event][id];

      if (_.keys(getListeners(event)).length === 0)
        deleteEvent(event);
      
      return true;
    }

    return false;
  };

  /** 
   * removes all the listeners for a given event
   */
  function deleteEvent(event) {
    if (hasListeners(event)) {
      delete context._events[event];
      return true;
    }

    return false;
  };

  return context;
}

function toArray(str) {
  return _.castArray(_.isString(str) ? str.split(',') : str);
}

function generateTest(pattern) {
  if (_.isString(pattern)) {
    try {
      return new RegExp(pattern, 'i');
    }
    catch (err) {
      throw new Error('Error in pattern: ' + pattern + '\n' + err);
    }
  }

  return pattern;
}

module.exports = EventsContext;