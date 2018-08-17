'use strict';

const _ = require('lodash');
const StateStorage = require('../lib/es-cache-state-storage');

let mgetData;
let getData;
let bulkData;

const context = {
    foundation: {
        apis: {
            elasticsearch: () => ({
                mget: () => Promise.resolve(mgetData),
                get: () => Promise.resolve(getData)
            })
        },
        getConnection: () => ({
            client: {
                bulk: (request) => {
                    bulkData = request;
                    return Promise.resolve();
                }
            }
        })
    }
};


function createMgetData(dataArray) {
    return dataArray.map((item) => {
        const doc = {
            _index: 'index',
            _type: 'type',
            _id: item.id,
            _version: 1,
            found: true,
            _source: item
        };

        return doc;
    });
}

const doc = {
    id: 1,
    data: 'thisIsSomeData'
};


const docArray = [
    {
        id: '1',
        data: 'thisIsSomeData'
    },
    {
        id: '2',
        data: 'thisIsSomeData'
    },
    {
        id: '3',
        data: 'thisIsLotsOfData'
    }
];

const config = {};

describe('es backed cache', () => {
    it('set should update storage for doc', () => {
        const stateStorage = new StateStorage(context, config);
        stateStorage.set(doc);
        expect(stateStorage.count()).toBe(1);
    });

    it('set should update storage for doc no persistance for single doc', () => {
        config.persist = true;
        const stateStorage = new StateStorage(context, config);
        stateStorage.set(doc, true);
        expect(stateStorage.count()).toBe(1);
    });

    it('mset should update storage for many docs and persist doc if specified', () => {
        config.persist = true;
        const stateStorage = new StateStorage(context, config);
        return stateStorage.mset(docArray)
            .then(() => {
                expect(stateStorage.count()).toBe(3);
                // bulk requests double the array size
                expect(bulkData.body.length).toBe(6);
            });
    });

    it('get should return doc state', () => {
        const stateStorage = new StateStorage(context, config);
        stateStorage.set(doc);
        return stateStorage.get(1)
            .then(result => expect(result).toEqual({ id: 1, data: 'thisIsSomeData' }));
    });

    it('get should return doc state even if not in cache', () => {
        const stateStorage = new StateStorage(context, config);
        getData = { id: '1', data: 'thisIsSomeData' };
        return stateStorage.get(doc)
            .then(result => expect(result).toEqual({ id: '1', data: 'thisIsSomeData' }));
    });

    fit('mget should return doc state for docs in cache and es', () => {
        config.persist = true;
        const stateStorage = new StateStorage(context, config);
        mgetData = {
            docs: createMgetData(docArray.slice(0, 1))
        };
        return stateStorage.mset(docArray.slice(1, 3))
            .then(() => stateStorage.mget(docArray))
            .then((result) => {
                expect(_.keys(result).length).toBe(3);
                expect(result['1']).toEqual({ id: '1', data: 'thisIsSomeData', _id: '1' });
            });
    });

    it('dedupe removes docs with duplicate keys', () => {
        const doubleDocs = docArray.concat(_.cloneDeep(docArray));
        const stateStorage = new StateStorage(context, config);
        const deduped = stateStorage._dedupeDocs(doubleDocs);
        expect(doubleDocs.length).toBe(6);
        expect(deduped.length).toBe(3);
    });
});
