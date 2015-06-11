var expect = require('chai').expect;
var buildMarty = require('../../../test/lib/buildMarty');
var describeStyles = require('../../../test/lib/describeStyles');

describeStyles('LocalStorageStateSource', function (styles) {
  var source, Marty;

  beforeEach(function () {
    Marty = buildMarty();
    localStorage.clear();
    var Source = styles({
      classic: function () {
        return Marty.createStateSource({
          type: 'localStorage'
        });
      },
      es6: function () {
        return class LocalStorage extends Marty.LocalStorageStateSource { };
      }
    });

    source = new Source();
  });

  describe('#createRepository()', function () {
    it('should expose get and set methods', function () {
      expect(source).to.have.property('get');
      expect(source).to.have.property('set');
    });
  });

  describe('#set()', function () {
    beforeEach(function () {
      source.set('foo', 'bar');
    });

    it('should store data under key in localStorage', function () {
      expect(localStorage.getItem('foo')).to.equal('bar');
    });
  });

  describe('#get()', function () {
    beforeEach(function () {
      localStorage.setItem('foo', 'bar');
    });

    it('should retrieve data under key in localStorage', function () {
      expect(source.get('foo')).to.equal('bar');
    });
  });

  describe('#set(object)', function () {
    beforeEach(function () {
      source.set('fooObj', { foo: 'bar' });
    });

    it('should store the json serialized data under key in localStorage', function () {
      expect(localStorage.getItem('fooObj')).to.equal(JSON.stringify({ foo: 'bar' }));
    });
  });

  describe('#get(object)', function () {
    beforeEach(function () {
      localStorage.setItem('fooObj', JSON.stringify({ foo: 'bar' }));
    });

    it('should retrieve the data under key in localStorage and return an object', function () {
      expect(source.get('fooObj')).to.eql({ foo: 'bar' });
    });
  });

  describe('#namespace', function () {
    beforeEach(function () {
      var Source = styles({
        classic: function () {
          return Marty.createStateSource({
            namespace: 'baz',
            type: 'localStorage'
          });
        },
        es6: function () {
          return class LocalStorage extends Marty.LocalStorageStateSource {
            get namespace() {
              return 'baz';
            }
          };
        }
      });

      source = new Source();
    });

    describe('when you pass in a namespace', function () {
      describe('when retrieving data', function () {
        beforeEach(function () {
          localStorage.setItem('bazfoo', 'bar');
        });

        it('should prepend namespace to key', function () {
          expect(source.get('foo')).to.equal('bar');
        });
      });

      describe('when storing data', function () {
        beforeEach(function () {
          source.set('foo', 'bar');
        });

        it('should prepend namespace to key', function () {
          expect(localStorage.getItem('bazfoo')).to.equal('bar');
        });
      });
    });
  });
});