'use strict';

const LRU = require('lru-cache');
const StateStorage = require('./state-storage');

class CacheStateStorage extends StateStorage {
    constructor(config) {
        super();
        this.id_field = config.id_field || 'id';
        this.cache = LRU({ max: config.cache_size || 1000000 });
    }

    get(key) {
        return this.cache.get(key);
    }

    mget(docArray) {
        return docArray.reduce((cachedState, doc) => {
            const key = doc[this.id_field];
            const state = this.cache.get(key);
            if (state) cachedState[key] = state;
            return cachedState;
        }, {});
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

    has(doc) {
        return this.cache.has(doc[this.id_field]);
    }
}

module.exports = CacheStateStorage;
