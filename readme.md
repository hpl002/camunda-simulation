# todo

## Problem
1. external worker and controller can go out of sync
   1. controller moves too fast
      1. updates simulation clock and starts new process before the process engine has had time to process it and the worker has had time to add it to pendingEvents queue
   2. fire event and then wait until its next event has been registered by worker and added to queue or proceed if it has ended


 

## Pending tasks
1. introduce resouce 
2. make overall configurability a bit easier

--> see task board








 
 


POST request 
 - specify input distribution
 - specify simulation model (bpmn file)
 - specifify graph db (filename or db name)


 

proper error handling
 - you get a http 200 even if process doesnt start 

diagram validation