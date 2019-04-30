'use strict';

const LRU = require('lru-cache');
const StateStorage = require('./state-storage');


function dispose(key, doc) {
    this.disposedDocs.push(doc);
}

class CacheStateStorage extends StateStorage {
    constructor(config) {
        super();
        const lruConfig = {
            max: config.cache_size || 1000000,
            maxAge: config.max_age || 24 * 3600 * 1000
        };
        if (config.save_disposed) {
            lruConfig.dispose = dispose.bind(this);
        }
        this.id_field = config.id_field || 'id';
        this.disposedDocs = [];
        this.cache = new LRU(lruConfig);
    }

    get(doc) {
        return this.cache.get(doc[this.id_field]);
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

    get disposed() {
        const r = this.disposedDocs;
        this.disposedDocs = [];
        return r;
    }
}

module.exports = CacheStateStorage;
