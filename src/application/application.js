let _ = require('../mindash');
let log = require('../core/logger');
let timeout = require('../core/utils/timeout');
let deferred = require('../core/utils/deferred');
let renderToString = require('./renderToString');
let FetchDiagnostics = require('./fetchDiagnostics');
let createDispatcher = require('../core/createDispatcher');
let UnknownStoreError = require('../errors/unknownStoreError');
let DEFAULT_TIMEOUT = 1000;
let SERIALIZED_WINDOW_OBJECT = '__marty';

module.exports = function (React) {
  class Application {
    constructor(options) {
      options = options || {};

      let dispatcher = createDispatcher();

      // Needed because we don't have access to actual Application type
      this.__isApplication = true;
      this.__isCoreType = true;
      this.__types = {};

      _.extend(this, options);

      Object.defineProperty(this, 'dispatcher', {
        get() {
          return dispatcher;
        }
      });
    }

    bindTo(InnerComponent) {
      let app = this;

      if (!InnerComponent) {
        throw new Error('Must specify an inner component');
      }

      return React.createClass({
        childContextTypes: {
          app: React.PropTypes.object
        },
        getChildContext() {
          return { app: app };
        },
        render() {
          return <InnerComponent ref="subject" {...this.props} />;
        }
      });
    }

    getAll(type) {
      return this.__types[type] || {};
    }

    getAllStores() {
      return this.getAll('Store');
    }

    register(key, ctor) {
      if (!this.dispatcher) {
        throw new Error('`super()` must be called before you can register anything');
      }

      if (!key) {
        throw new Error('Must specify a key or an object');
      }

      if (_.isString(key)) {
        if (!_.isFunction(ctor)) {
          throw new Error('Must pass in a instantiable object');
        }

        let obj = new ctor({
          app: this
        });

        let type = obj.__type;

        if (type) {
          if (!this.__types[type]) {
            this.__types[type] = {};
          }

          this.__types[type][key] = obj;
        }

        if (key.indexOf('.') === -1) {
          this[key] = obj;
        } else {
          var container = this;
          var parts = key.split('.');

          _.each(_.initial(parts), (part) => {
            if (_.isUndefined(container[part])) {
              container[part] = {};
            }

            container = container[part];
          });

          container[_.last(parts)] = obj;
        }
      }

      if (_.isObject(key)) {
        let registerObject = (obj, prefix) => {
          _.each(obj, (ctor, key) => {
            if (prefix) {
              key = `${prefix}.${key}`;
            }

            if (_.isFunction(ctor)) {
              this.register(key, ctor);
            } else {
              registerObject(ctor, key);
            }
          });
        };

        registerObject(key);
      }
    }

    fetch(cb, options) {
      let fetchFinished;

      options = _.defaults(options || {}, {
        timeout: DEFAULT_TIMEOUT
      });

      this.__deferredFetchFinished = deferred();
      this.__diagnostics = new FetchDiagnostics();
      fetchFinished = this.__deferredFetchFinished.promise;

      try {
        cb.call(this);
      } catch (e) {
        this.__deferredFetchFinished.reject(e);

        return fetchFinished;
      }

      if (!this.__diagnostics.hasPendingFetches) {
        this.__deferredFetchFinished.resolve();
      }

      return Promise
        .race([fetchFinished, timeout(options.timeout)])
        .then(() => this.__diagnostics.toJSON());
    }

    fetchStarted(storeId, fetchId) {
      let diagnostics = this.__diagnostics;

      if (diagnostics) {
        diagnostics.fetchStarted(storeId, fetchId);
      }
    }

    fetchFinished(storeId, fetchId, status, options) {
      let diagnostics = this.__diagnostics;

      if (diagnostics) {
        diagnostics.fetchFinished(storeId, fetchId, status, options);

        if (!diagnostics.hasPendingFetches) {
          this.__deferredFetchFinished.resolve();
        }
      }
    }

    clearState() {
      _.invoke(this.getAllStores(), 'clear');
    }

    replaceState(states) {
      _.each(this.getAllStores(), (store, id) => {
        if (states[id]) {
          store.replaceState(states[id]);
        }
      });
    }

    rehydrate(storeStates) {
      let stores = this.getAllStores();

      storeStates = storeStates || getStoreStatesFromWindow();

      _.each(storeStates, (dehydratedStore, storeId) => {
        let store = stores[storeId];
        let state = dehydratedStore.state;

        if (!store) {
          throw new UnknownStoreError(storeId);
        }

        store.__fetchHistory = dehydratedStore.fetchHistory;

        if (_.isFunction(store.rehydrate)) {
          store.rehydrate(state);
        } else {
          try {
            store.replaceState(state);
          } catch (e) {
            log.error(
              `Failed to rehydrate the state of ${storeId}. You might be able ` +
              `to solve this problem by implementing Store#rehydrate()`
            );

            throw e;
          }
        }
      });

      function getStoreStatesFromWindow() {
        if (!window || !window[SERIALIZED_WINDOW_OBJECT]) {
          return;
        }

        return window[SERIALIZED_WINDOW_OBJECT].stores;
      }
    }

    dehydrate() {
      let dehydratedStores = {};
      let stores = this.getAllStores();

      _.each(stores, (store, id) => {
        dehydratedStores[id] = {
          fetchHistory: store.__fetchHistory,
          state: (store.dehydrate || store.getState).call(store)
        };
      });

      dehydratedStores.toString = function () {
        return `(window.__marty||(window.__marty={})).stores=${JSON.stringify(dehydratedStores)}`;
      };

      dehydratedStores.toJSON = function () {
        return _.omit(dehydratedStores, 'toString', 'toJSON');
      };

      return dehydratedStores;
    }

    renderToString(element, options) {
      return renderToString(
        this,
        React.renderToString,
        element,
        options
      );
    }

    renderToStaticMarkup(element, options) {
      return renderToString(
        this,
        React.renderToStaticMarkup,
        element,
        options
      );
    }
  }

  return Application;
};