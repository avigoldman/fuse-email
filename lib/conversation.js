const logger = require(__dirname + '/logger');
const _      = require('lodash');

function Conversation() {
  var convo = {
    events: {}
  };

  /**
   * registers a listener on the given event
   */ 
  convo.on = function(event, cb) {
    logger.debug('Setting up a handler for', event);

    var events = event.split(',');
    _.each(events, (event) => {
      if (_.isUndefined(convo.events[event]))
        convo.events[event] = [];

      convo.events[event].push(cb);
    });
  };

  /**
   * Registers a listener on the given event
   *
   * If one of these handlers is triggered no following handlers arre
   */
  convo.hears = function(pattern, event, cb) {
  };


  /**
   * triggers the given event with the specified params
   */
  convo.trigger = function(event, params) {
    if (!_.isUndefined(convo.events[event])) {
      _.each(convo.events[event], function(eventHandler) {
        return eventHandler.apply(convo, params);        
      });
    }
    else {
      logger.debug('No handler for', event);
    }
  };

  return convo;
}

module.exports = Conversation;