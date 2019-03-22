# teraslice state storage - currently experimental

Module to save state for teraslice processes.  Currently uses elasticsearch for state persistance and lru-caching to reduce network calls.  Requires job context for connection details and config object which is passed from the _op in the teraslice job.

## Intallation and Usage
### Installation
> Installation TBD
### Usage
> `const StateStorage = require('teraslice-state-storage');`  
> `const stateStorage = new StateStorage(context, config);`  
> `stateStorage.count();`  
> `stateStorage.mset(docArray);`  

## Configuration Options:
  * __cache_limit__ - max number of items to store in the cache (not memory size)  
  positive integer, default: 1000000

  * __max_age__ - length of time before a record expires in milliseconds  
  positive integer, default: 24 hours

  * __connection__ - elasticsearch connection  
   string, default: 'default'

  * __index__ - name of elasticsearch index  
  string, default: 'index'

  * __type__ - type of the elasticsearch data
  string, default: 'type'

  * __chunk_size__ - how many docs to send in the elasticsearch mget request at a time  
  postitive integer, default is 2500

  * __concurrency__ - number of cuncurrent requests to elasticsearch  
  positive integer, default: 100

  * __source_fields__ - fields to retreive from elasticsearch  
  array of fields, defaults to all fields

  * __id_field__ - specifies the field to use as the key for caching and retrieving docs from elasticsearch  
  string, default: 'id'
  
  * __persist__ - If set to true will save state in storage for mset, doest not apply to set.  
  boolean, default: false

  * __persist_field__ - If persist is true this option is the name of the key field that will be the key in the es bulk update, this may be the same as the id_field but not necessarily.  
  string, default: 'key'

## Functions:
* __get__ - expects an object with the `id_field` as a property and returns an object with an id and saved fields  
  example: `get(doc)`

* __mget__ - expects an array of objects and returns an object.  Returns a promise and the data returned is an object.  
  example: `mget(docArray)`

* __set__ - expects and object, boolean is optional. Updates state with an option to save state in storage  
  Returns a promise.  
  example: `set(doc)`  
  example: `set(doc, true)` - saves the state in storage

* __mset__ - expects an array of objects boolean is optional.  Updates state with an option to save state in storage.  
  Returns a promise.  
  example: `mset(docArray)`  
  example: `mset(docArray, true)` - saves the state in storage

* count - returns the number docs currently saved in the cache  
  example: `count()`

