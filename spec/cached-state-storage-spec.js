'use strict';

const _ = require('lodash');
const CachedStateStorage = require('../lib/cache-state-storage');

const doc = {
    id: 1,
    data: 'thisIsSomeData'
};


const docArray = [
    {
        id: 1,
        data: 'thisIsSomeData'
    },
    {
        id: 2,
        data: 'thisIsSomeData'
    },
    {
        id: 3,
        data: 'thisIsLotsOfData'
    }
];

describe('lru cached state storage', () => {
    const config = {
        id_field: 'id',
        cache_size: 100000
    };

    it('set should add items to the storage', () => {
        const cache = new CachedStateStorage(config);
        cache.set(doc);
        expect(cache.count()).toBe(1);
    });

    it('get should return data from storage', () => {
        const cache = new CachedStateStorage(config);
        cache.set(doc);
        const cachedData = cache.get(doc);
        expect(cachedData).toEqual({ id: 1, data: 'thisIsSomeData' });
    });

    it('get should return undefined if not stored', () => {
        const cache = new CachedStateStorage(config);
        const cachedData = cache.get(doc);
        expect(cachedData).toBeUndefined();
    });

    it('delete should delete item from storage', () => {
        const cache = new CachedStateStorage(config);
        cache.set(doc);
        cache.delete(doc);
        expect(cache.get(doc)).toBeUndefined();
    });

    it('mset should add many items to storage', () => {
        const cache = new CachedStateStorage(config);
        cache.mset(docArray);
        expect(cache.count()).toEqual(3);
    });

    it('mget should return many items from storage', () => {
        const cache = new CachedStateStorage(config);
        cache.mset(docArray);
        const data = cache.mget(docArray);
        expect(_.keys(data).length).toBe(3);
    });

    it('mdelete should delete many records from storage', () => {
        const cache = new CachedStateStorage(config);
        cache.mset(docArray);
        cache.mdelete(docArray);
        expect(cache.count()).toBe(0);
    });
});
