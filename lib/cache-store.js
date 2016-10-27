"use strict";
const LocalStorage = require('node-localstorage').LocalStorage;

/* eslint-disable */
function CacheStore(cfg) {
  this.cache = {};
  this.size = 0;
  this.entries = 0;
  this.config = cfg;
  if(!this.config.folderCache)
    throw new Error('Need select one folder to store cache');
  this.localStorage = new LocalStorage(this.config.folderCache);
}

CacheStore.prototype.cleanCache = function(minFreeSize) {
  const keys = Object.keys(this.cache);
  keys.sort((a, b) => this.cache[a].access - this.cache[b].access);
  let freed = 0;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const entry = this.cache[key];
    if (freed >= minFreeSize) {
      break;
    }
    delete this.cache[key];
    const freeSize = key.length + entry.html.length;
    freed += freeSize;
    this.size -= freeSize;
    this.entries--;
  }
};

CacheStore.prototype.newEntry = function(name, key, value) {
  let storageData = this.localStorage.getItem('storageData');

  if (!storageData) {
    storageData = { entries : 0, size : 0 };
  } else {
    storageData = JSON.parse(storageData);
  }

  const entryKey = `${name}-${key}`;
  const size = entryKey.length + value.html.length;
  const newSize = storageData.size + size;
  if (newSize > this.config.MAX_CACHE_SIZE) {
    const freeSize = Math.max(size, this.config.minFreeCacheSize);
    this.cleanCache(Math.min(freeSize, this.config.maxFreeCacheSize));
  }

  // this.cache[entryKey] = value;
  value.hits = 0;
  value.access = Date.now();
  storageData.size = newSize;
  storageData.entries++;
  this.localStorage.setItem('storageData', JSON.stringify(storageData));
  this.localStorage.setItem(entryKey, JSON.stringify(value));
};

CacheStore.prototype.getEntry = function(name, key) {
  const entryKey = `${name}-${key}`;
  // const x = this.cache[entryKey];
  let x = this.localStorage.getItem(entryKey);

  if (x) {
    x = JSON.parse(x);
    x.hits++;
    x.access = Date.now();
  }
  return x;
};

module.exports = CacheStore;
