let noopStorage = require('../core/noopStorage');
let StateSource = require('../core/stateSource');

class LocalStorageStateSource extends StateSource {
  constructor(options) {
    super(options);

    this._isLocalStorageStateSource = true;
    this.storage = typeof window === 'undefined' ? noopStorage : window.localStorage;
  }

  get(key) {
    let raw = this.storage.getItem(getNamespacedKey(this, key));
    return raw ? JSON.parse(raw) : raw;
  }

  set(key, value) {
    let raw = JSON.stringify(value);
    return this.storage.setItem(getNamespacedKey(this, key), raw);
  }

  static get defaultNamespace() {
    return '';
  }
}

function getNamespacedKey(source, key) {
  return getNamespace(source) + key;
}

function getNamespace(source) {
  return source.namespace || LocalStorageStateSource.defaultNamespace;
}

module.exports = LocalStorageStateSource;