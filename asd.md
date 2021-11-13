
refactor stuff
upload config to app
upload config to camunda
 - wipe any and all existing configs entirely
 - parse in tokens


remove all complexities
start to build app from scratch and write tests for every feature:
1 - remove all neo4j stuff

------
sprint 1 - 
    upload configuration files
        bpmn model
        input distribution
        execute model
        log to mongo
        get data from mongo
        clear all configs in preparation for new execution


task duration as fixed value


sprint 2  - 
    conceptual model task attributes         
        task
            duration
            waiting period before activation
            resource dependency

sprint 3 - 
    create model that describes the relationship between a taks and its attributes


sprint 4 - 
    implement task attributes
        




sprint 5 - 
    conceptual model of resources
        efficiency(a resource works at a set speed)
        task correlation(a resource is tied to a task somehow)

sprint 6 - 
    create model that describes resorources and their attributes
    create model that describes how resources are tied to tasks         

sprint 7 - 
    implement resources         


---

Resource and taks relations

sprint 8  - 
    conceptual model resource and task relations         
         a taks can be completed by a specific resoruce
         a taks can be completed by some random resource as long as it is qualified
         a task can require a combination of resources which match this description

sprint 10  - 
    conceptual model resource descriptons         
         a resource can be described using any number of attributes
         a task can require a resource that matches matches all of some of these qualifications
         this condition can be generic or exact

sprint 11  - 
    resource allocation strategies         
         a process may have a large pool of resourecs, many of which are qualified for the same sort of tasks
         there needs to exist allocation strategies that determine which resource to select for a given task
          - should we use resources sparingly and try to use the same resources whenever possible
          - should we try to distribute the work load evenly over all resources
          - how can resource attributes contribute
            - some resources are better at some tasks than others
            - should we select the resoruces that are best suted , i.e. have the highest efficiency
            - should we try and select resoruces which do not have the highest efficiency in the hopes tha this may act as training

sprint 12  - 
    advanced resource attributes
        - human factors which are difficult to measure precicely
          - stress
          - content/happiness(how content are the resources with the tasks they are given. Are they stimulated)         
            - little stimulation can influence efficiency
 ----


scheduling
sprint 13  -  
    resources work in shifts
         - resources are available according to a set schedule
         - how does scheduling influence resource behavior and efficiency
           - do they work slower during the night perhaps