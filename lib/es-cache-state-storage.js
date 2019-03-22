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

    _esGet(doc) {
        const request = {
            index: this.index,
            type: this.type,
            id: doc[this.id_field]
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


    _dedupeDocs(docArray, id_field = this.id_field) {
        // returns uniq docs from an array of docs
        const uniqKeys = {};
        return docArray.filter((doc) => {
            const id = doc[id_field];
            const uniq = _.has(uniqKeys, id) ? false : uniqKeys[id] = true;
            return uniq;
        });
    }

    async get(doc) {
        let cached = super.get(doc);
        if (!cached) {
            cached = await this._esGet(doc);
        }
        return cached;
    }

    async mget(docArray) {
        // dedupe docs
        const uniqDocs = this._dedupeDocs(docArray);

        const savedDocs = {};
        const unCachedDocKeys = [];

        // need to add valid docs to return object and find non-cached docs
        uniqDocs.forEach((doc) => {
            const key = doc[this.id_field];
            const cachedDoc = super.get(doc);

            if (cachedDoc) {
                savedDocs[key] = cachedDoc;
                return;
            }

            if (key) {
                unCachedDocKeys.push(key);
            }
        });

        // es search for keys not in cache
        const mgetResults = await Promise.map(_.chunk(unCachedDocKeys, this.chunk_size),
            chunk => this._esMget(chunk), { concurrency: this.concurrency });

        // update cache based on mget results
        mgetResults.forEach((result) => {
            result.docs.forEach((doc) => {
                if (doc.found) {
                    // need to set id field in doc
                    _.set(doc, `_source.${this.id_field}`, doc._id);

                    // update cache
                    this.set(doc._source);

                    // updated savedDocs object
                    _.set(savedDocs, doc._id, doc._source);
                }
            });
        });
        // return state
        return savedDocs;
    }

    async set(doc) {
        // update cache, if persistance is needed use mset
        return super.set(doc);
    }

    async mset(docArray, keyField) {
        const dedupedDocs = this._dedupeDocs(docArray, keyField);
        if (this.persist) {
            return Promise.all([super.mset(dedupedDocs), this._esBulkUpdate(dedupedDocs)]);
        }
        return super.mset(dedupedDocs);
    }
}

module.exports = EsCacheStateStorage;
