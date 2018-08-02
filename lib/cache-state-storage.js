'use strict';

const LRU = require('lru-cache');
const StateStorage = require('./state-storage');

class CacheStateStorage extends StateStorage {
    constructor(config) {
        super();
        this.id_field = config.id_field || 'id';
        this.cache = LRU({ max: config.cache_size || 1000000 });
    }

    get(doc) {
        return this.cache.get(doc[this.id_field]);
    }

    mget(docArray) {
        const stateObject = {};
        docArray.forEach((doc) => {
            const key = doc[this.id_field];
            if (this.cache.has(key)) {
                stateObject[key] = this.cache.get(key);
            }
        });
        return stateObject;
    }

    set(doc) {
        this.cache.set(doc[this.id_field], doc);
    }

    mset(docArray) {
        docArray.forEach(doc => this.set(doc));
    }

    delete(doc) {
        this.cache.del(doc[this.id_field]);
    }

    mdelete(docArray) {
        docArray.forEach(doc => this.delete(doc));
    }

    count() {
        return this.cache.itemCount;
    }
}

module.exports = CacheStateStorage;
