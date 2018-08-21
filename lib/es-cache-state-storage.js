'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const CacheStateStorage = require('./cache-state-storage');

class EsCacheStateStorage extends CacheStateStorage {
    constructor(context, config) {
        super(config);
        this.index = config.index || 'index';
        this.type = config.type || 'type';
        this.concurrency = config.concurrency || 100;
        this.source_fields = config.source_fields || [];
        this.chunk_size = config.chunk_size || 2500;
        this.id_field = config.id_field || 'id';
        this.persist = config.persist || false;

        this.client = context.foundation.getConnection({
            endpoint: config.connection || 'default',
            type: 'elasticsearch',
            cached: true
        }).client;

        let es;
        if (_.has(context, 'foundation.apis.elasticsearch')) {
            es = context.foundation.apis.elasticsearch(this.client, context.logger);
        } else {
            es = require('@terascope/elasticsearch-api')(this.client, context.logger);
        }
        this.es = es;
    }

    _esUpdateOne(doc) {
        const request = {
            index: this.index,
            type: this.type,
            id: this.id_field,
            body: doc
        };
        return this.es.indexWithId(request);
    }

    _esBulkUpdatePrep(dataArray) {
        const bulkRequest = [];
        dataArray.forEach((item) => {
            bulkRequest.push({
                index: {
                    _index: this.index,
                    _type: this.type,
                    _id: item[this.id_field]
                }
            });
            bulkRequest.push(item);
        });
        return bulkRequest;
    }

    _esBulkUpdate(docArray) {
        const bulkRequest = this._esBulkUpdatePrep(docArray);
        return Promise.map(_.chunk(bulkRequest, this.chunk_size),
            chunk => this.client.bulk(
                { body: chunk }
            ));
    }

    _esGet(key) {
        const request = {
            index: this.index,
            type: this.type,
            id: key
        };

        return this.es.get(request);
    }

    _esMget(query) {
        const request = {
            index: this.index,
            type: this.type,
            body: {
                ids: query
            }
        };
        if (this.source_fields.length > 0) request._source = this.source_fields;
        return this.es.mget(request);
    }


    _dedupeDocs(docArray) {
        // returns uniq docs from an array of docs
        const uniqKeys = {};
        return docArray.filter((doc) => {
            const id = doc[this.id_field];
            const uniq = _.has(uniqKeys, id) ? false : uniqKeys[id] = true;
            return uniq;
        });
    }

    async get(key) {
        let cached = super.get(key);
        if (!cached) {
            cached = await this._esGet(key);
        }
        return cached;
    }

    async mget(docArray) {
        // console.log(docArray);
        // dedupe docs
        const uniqDocs = this._dedupeDocs(docArray);
        // get currently cached docs
        const cachedDocs = super.mget(docArray);
        // get docs that are not cached
        const nonCachedKeys = uniqDocs.reduce((keyArray, doc) => {
            if (doc[this.id_field] && !_.has(cachedDocs, doc[this.id_field])) {
                keyArray.push(doc[this.id_field]);
            }
            return keyArray;
        }, []);
        // es search for keys not in cache
        const mgetResults = await Promise.map(_.chunk(nonCachedKeys, this.chunk_size),
            chunk => this._esMget(chunk), { concurrency: this.concurrency });
        // set data
        mgetResults.forEach((result) => {
            result.docs.forEach((doc) => {
                if (doc.found) {
                    const key = doc._id;
                    // set id field in doc
                    doc._source[this.id_field] = key;
                    // update cache
                    this.set(doc._source);
                    // add doc to return object
                    cachedDocs[key] = doc._source;
                    // console.log(this.cache);
                }
            });
        });
        return cachedDocs;
    }

    async set(doc) {
        return super.set(doc);
    }

    async mset(docArray) {
        const dedupedDocs = this._dedupeDocs(docArray);
        if (this.persist) {
            return Promise.all([super.mset(dedupedDocs), this._esBulkUpdate(dedupedDocs)]);
        }
        return super.mset(dedupedDocs);
    }
}

module.exports = EsCacheStateStorage;
