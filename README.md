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
  
  * __persist__ - If set to true will save state in storage for set or mset.  
  boolean, default: false

## Functions:
* __get__ - expects an object with the `id_field` as a property and returns an object with an id and saved fields  
  example: `get(doc)`

* __mget__ - expects an array of objects and returns an object  
  example: `mget(docArray)`

* __set__ - expects and object, boolean is optional. Updates state with an option to save state in storage  
  example: `set(doc)`  
  example: `set(doc, true)` - saves the state in storage

* __mset__ - expects an array of objects boolean is optional.  Updates state with an option to save state in storage.  
  example: `mset(docArray)`  
  example: `mset(docArray, true)` - saves the state in storage

* count - returns the number docs currently saved in the cache  
  example: `count()`

