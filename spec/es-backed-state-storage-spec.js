'use strict';

const _ = require('lodash');
const StateStorage = require('../lib/es-cache-state-storage');

let mgetData;
let getData;
let mgetRequest;
let bulkRequest;

const context = {
    foundation: {
        apis: {
            elasticsearch: () => ({
                mget: (mgetSearch) => {
                    mgetRequest = mgetSearch;
                    return Promise.resolve(mgetData);
                },
                get: () => Promise.resolve(getData)
            })
        },
        getConnection: () => ({
            client: {
                bulk: (request) => {
                    bulkRequest = request;
                    return Promise.resolve();
                }
            }
        })
    }
};


function createMgetData(dataArray, found = true) {
    return dataArray.map((item) => {
        const doc = {
            _index: 'index',
            _type: 'type',
            _version: 1,
            _id: item.id,
            found
        };

        if (found) {
            doc._source = item;
        }

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
        data: 'thisIsSomeDataFor1'
    },
    {
        id: '2',
        data: 'thisIsSomeDataFor2'
    },
    {
        id: '3',
        data: 'thisIsLotsOfDataFor3'
    }
];

describe('es backed cache', () => {
    let config = {};
    beforeEach(() => {
        mgetData = {
            docs: []
        };

        mgetRequest = [];
        bulkRequest = {};

        config = {
            id_field: 'id'
        };
    });

    it('should save doc in cache and retrieve it', async () => {
        const stateStorage = new StateStorage(context, config);

        // set doc in state
        stateStorage.set(doc);

        expect(stateStorage.count()).toBe(1);

        const stateDoc = await stateStorage.get(doc);
        expect(stateDoc).toEqual(doc);
    });

    it('should save many docs to cache and retrieve', async () => {
        config.id_field = 'id';

        const stateStorage = new StateStorage(context, config);

        await stateStorage.mset(docArray, 'id');
        expect(stateStorage.count()).toBe(3);

        const saved1 = await stateStorage.get(docArray[0]);
        const saved2 = await stateStorage.get(docArray[1]);
        const saved3 = await stateStorage.get(docArray[2]);

        expect(saved1).toEqual(docArray[0]);
        expect(saved2).toEqual(docArray[1]);
        expect(saved3).toEqual(docArray[2]);
    });

    it('should make an es bulk request if persist is true', async () => {
        config.id_field = 'id';
        config.persist = true;

        const stateStorage = new StateStorage(context, config);

        await stateStorage.mset(docArray, 'id');
        expect(stateStorage.count()).toBe(3);

        expect(bulkRequest.body.length).toBe(6);
        expect(bulkRequest.body[1]).toEqual(docArray[0]);
    });

    it('should ake an es request if doc not in cache', async () => {
        getData = { id: '1', data: 'thisIsSomeData' };
        const stateStorage = new StateStorage(context, config);

        const getResult = await stateStorage.get(getData);
        expect(getResult).toEqual({ id: '1', data: 'thisIsSomeData' });
    });

    it('should return object with all docs in cache and in es request', async () => {
        const stateStorage = new StateStorage(context, config);

        // set doc in cache
        await stateStorage.mset(docArray.slice(0, 1));

        // create bulk response
        mgetData = { docs: createMgetData(docArray.slice(1, 3)) };

        // state response
        const stateResponse = await stateStorage.mget(docArray);

        expect(_.isObject(stateResponse)).toBe(true);
        expect(_.keys(stateResponse).length).toBe(3);
        expect(_.get(stateResponse, '1')).toEqual(docArray[0]);
        expect(_.get(stateResponse, '2')).toEqual(docArray[1]);
        expect(_.get(stateResponse, '3')).toEqual(docArray[2]);
    });

    it('should return all the found and cached docs', async () => {
        const mgetDocArray = [];
        for (let i = 0; i < 5000; i += 1) {
            const aDoc = {
                id: `${i}`,
                data: `dataFor${i}`
            };

            mgetDocArray.push(aDoc);
        }

        // found by es
        const mgetDocs = createMgetData(mgetDocArray.slice(0, 2000));

        // not found by es
        const notFoundDocs = createMgetData(mgetDocArray.slice(2000, 3000), false);
        notFoundDocs.forEach(i => mgetDocs.push(i));

        mgetData = { docs: mgetDocs };

        const stateStorage = new StateStorage(context, config);

        // some docs already saved in cache
        await stateStorage.mset(mgetDocArray.slice(3000, 5000));

        // check that docs are in cache
        expect(stateStorage.count()).toBe(2000);

        // check on a doc
        const getCheck = await stateStorage.get(mgetDocArray['3484']);
        expect(getCheck).toEqual(mgetDocArray['3484']);

        // retrieve all the docs
        const mgetResult = await stateStorage.mget(mgetDocArray);

        // should not be any unfound docs
        expect(_.keys(mgetResult).length).toBe(4000);

        // check a found mget doc
        expect(mgetResult['1283']).toEqual(mgetDocArray['1283']);

        // check a found cached doc
        expect(mgetResult['4483']).toEqual(mgetDocArray['4483']);

        // check an unfound doc
        expect(mgetResult['2381']).toBeUndefined();
    });

    it('should not create get or mget requests with undefined keys', async () => {
        const testDocs = [
            { data: 'someValue' },
            { id: '1', data: 'anotherValue' }
        ];

        const stateStorage = new StateStorage(context, config);
        const getRequest = await stateStorage.get(testDocs[0]);
        expect(getRequest).toBeUndefined();

        await stateStorage.mget(testDocs);
        expect(mgetRequest.body.ids.length).toBe(1);
    });

    it('should allow mset to use a persist field', async () => {
        const testDocs = [
            { id: 1, data: 'someData', name: 'bob' },
            { id: 2, data: 'someData2', name: 'joe' },
            { id: 3, data: 'someData3', name: 'ron' }
        ];

        config.persist_field = 'name';
        config.persist = true;

        const stateStorage = new StateStorage(context, config);

        await stateStorage.mset(testDocs);

        expect(bulkRequest.body[0].index._id).toBe('bob');
        expect(bulkRequest.body[2].index._id).toBe('joe');
        expect(bulkRequest.body[4].index._id).toBe('ron');
    });

    it('dedupe removes docs with duplicate keys', () => {
        const doubleDocs = docArray.concat(_.cloneDeep(docArray));

        const stateStorage = new StateStorage(context, config);

        const deduped = stateStorage._dedupeDocs(doubleDocs);
        expect(doubleDocs.length).toBe(6);
        expect(deduped.length).toBe(3);
    });
});
