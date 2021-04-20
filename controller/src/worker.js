var Worker = require('camunda-worker-node');
var Backoff = require('camunda-worker-node/lib/backoff');

var engineEndpoint = 'http://localhost:8080/engine-rest';

/* copy pasta from https://github.com/nikku/camunda-worker-node */

var worker = Worker(engineEndpoint, {
  workerId: 'some-worker-id',
  use: [
    Backoff
  ]
});

// a work subscription may access and modify process variables
worker.subscribe('work:A', [ 'numberVar' ], async function(context) {

  var newNumber = context.variables.numberVar + 1;

  // fail with an error if things go awry
  if (ooops) {
    throw new Error('no work done');
  }

  // complete with update variables
  return {
    variables: {
      numberVar: newNumber
    }
  };
});

// stop the worker instance with the application
worker.stop();