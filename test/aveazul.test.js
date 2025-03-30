const AveAzul = require('../lib/aveazul');

describe('AveAzul', () => {
  describe('constructor', () => {
    test('should create a new AveAzul instance', () => {
      const promise = new AveAzul((resolve) => resolve(42));
      expect(promise).toBeInstanceOf(AveAzul);
      expect(promise).toBeInstanceOf(Promise);
    });

    test('should handle rejection in constructor', async () => {
      const error = new Error('test');
      const promise = new AveAzul((resolve, reject) => reject(error));
      await expect(promise).rejects.toBe(error);
    });
  });

  describe('instance methods', () => {
    test('tap() should execute side effects and return original value', async () => {
      const sideEffect = jest.fn();
      const result = await new AveAzul((resolve) => resolve(42))
        .tap(sideEffect);
      
      expect(sideEffect).toHaveBeenCalledWith(42);
      expect(result).toBe(42);
    });

    test('filter() should filter array elements', async () => {
      const result = await new AveAzul((resolve) => resolve([1, 2, 3, 4, 5]))
        .filter(x => x % 2 === 0);
      
      expect(result).toEqual([2, 4]);
    });

    test('map() should transform array elements', async () => {
      const result = await new AveAzul((resolve) => resolve([1, 2, 3]))
        .map(x => x * 2);
      
      expect(result).toEqual([2, 4, 6]);
    });

    test('return() should inject a new value', async () => {
      const result = await new AveAzul((resolve) => resolve(42))
        .return(100);
      
      expect(result).toBe(100);
    });

    test('each() should iterate over array elements', async () => {
      const sideEffect = jest.fn();
      const result = await new AveAzul((resolve) => resolve([1, 2, 3]))
        .each(sideEffect);
      
      expect(sideEffect).toHaveBeenCalledTimes(3);
      expect(sideEffect).toHaveBeenNthCalledWith(1, 1, 0);
      expect(sideEffect).toHaveBeenNthCalledWith(2, 2, 1);
      expect(sideEffect).toHaveBeenNthCalledWith(3, 3, 2);
      expect(result).toBeUndefined();
    });

    test('delay() should delay resolution', async () => {
      const start = Date.now();
      await new AveAzul((resolve) => resolve(42))
        .delay(101);
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThanOrEqual(100);
    });

    test('timeout() should reject after specified time', async () => {
      const promise = new AveAzul((resolve) => setTimeout(() => resolve(42), 100))
        .timeout(50);
      
      await expect(promise).rejects.toThrow('Operation timed out');
    });

    test('timeout() should resolve if operation completes in time', async () => {
      const result = await new AveAzul((resolve) => setTimeout(() => resolve(42), 50))
        .timeout(100);
      
      expect(result).toBe(42);
    });

    test('timeout() should handle rejection', async () => {
      const error = new Error('test');
      const promise = new AveAzul((resolve, reject) => setTimeout(() => reject(error), 50))
        .timeout(100);
      
      await expect(promise).rejects.toBe(error);
    });

    test('try() should handle synchronous functions', async () => {
      const result = await new AveAzul((resolve) => resolve())
        .try(() => 42);
      
      expect(result).toBe(42);
    });

    test('try() should handle asynchronous functions', async () => {
      const result = await new AveAzul((resolve) => resolve())
        .try(() => Promise.resolve(42));
      
      expect(result).toBe(42);
    });

    test('try() should handle errors', async () => {
      const promise = new AveAzul((resolve) => resolve())
        .try(() => { throw new Error('test error'); });
      
      await expect(promise).rejects.toThrow('test error');
    });

    test('props() should resolve object properties', async () => {
      const result = await new AveAzul((resolve) => resolve())
        .props({
          a: Promise.resolve(1),
          b: Promise.resolve(2),
          c: 3
        });
      
      expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });

    test('catchIf() should catch specific errors', async () => {
      const result = await new AveAzul((resolve, reject) => reject(new TypeError('test')))
        .catchIf(TypeError, () => 42);
      
      expect(result).toBe(42);
    });

    test('catchIf() should catch errors matching predicate function', async () => {
      const result = await new AveAzul((resolve, reject) => reject(new Error('test')))
        .catchIf(err => err.message === 'test', () => 42);
      
      expect(result).toBe(42);
    });

    test('catchIf() should rethrow unmatched errors', async () => {
      const error = new Error('test');
      const promise = new AveAzul((resolve, reject) => reject(error))
        .catchIf(TypeError, () => 42);
      
      await expect(promise).rejects.toBe(error);
    });

    test('tapCatch() should execute side effects on rejection', async () => {
      const sideEffect = jest.fn();
      const promise = new AveAzul((resolve, reject) => reject(new Error('test')))
        .tapCatch(sideEffect);
      
      await expect(promise).rejects.toThrow('test');
      expect(sideEffect).toHaveBeenCalled();
    });

    test('reduce() should reduce array elements', async () => {
      const result = await new AveAzul((resolve) => resolve([1, 2, 3, 4]))
        .reduce((acc, val) => acc + val, 0);
      
      expect(result).toBe(10);
    });

    test('reduce() should work without initial value', async () => {
      const result = await new AveAzul((resolve) => resolve([1, 2, 3, 4]))
        .reduce((acc, val) => acc + val, 0);
      
      expect(result).toBe(10);
    });

    test('throw() should return rejected promise', async () => {
      const promise = new AveAzul((resolve) => resolve())
        .throw(new Error('test'));
      
      await expect(promise).rejects.toThrow('test');
    });

    test('catchThrow() should catch and throw new error', async () => {
      const promise = new AveAzul((resolve, reject) => reject(new Error('original')))
        .catchThrow(new Error('new error'));
      
      await expect(promise).rejects.toThrow('new error');
    });

    test('catchReturn() should catch and return value', async () => {
      const result = await new AveAzul((resolve, reject) => reject(new Error('test')))
        .catchReturn(42);
      
      expect(result).toBe(42);
    });

    test('get() should retrieve property value', async () => {
      const result = await new AveAzul((resolve) => resolve({ a: { b: 42 } }))
        .get('a.b');
      
      expect(result).toBe(42);
    });

    test('get() should throw on null/undefined value', async () => {
      const promise = new AveAzul((resolve) => resolve(null))
        .get('a.b');
      
      await expect(promise).rejects.toThrow("Cannot read property 'a.b' of null");
    });

    test('get() should throw on undefined property', async () => {
      const promise = new AveAzul((resolve) => resolve({}))
        .get('a.b');
      
      await expect(promise).rejects.toThrow("Cannot read property 'b' of undefined");
    });

    test('get() should handle intermediate null/undefined values', async () => {
      const promise = new AveAzul((resolve) => resolve({ a: null }))
        .get('a.b');
      
      await expect(promise).rejects.toThrow("Cannot read property 'b' of null");
    });
  });

  describe('static methods', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('delay() should handle single argument using arguments object', async () => {
      const args = [101];
      const start = Date.now();
      await AveAzul.delay.apply(null, args);
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(100);
    });

    test('delay() should handle single argument directly', async () => {
      const start = Date.now();
      await AveAzul.delay(101);
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(100);
    });

    test('delay() should handle two arguments using arguments object', async () => {
      const args = [101, 42];
      const start = Date.now();
      const result = await AveAzul.delay.apply(null, args);
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(100);
      expect(result).toBe(42);
    });

    test('reduce() should handle empty array without initial value and return undefined', async () => {
      const fn = jest.fn();
      const result = await AveAzul.reduce([], fn);
      expect(fn).not.toHaveBeenCalled();
      expect(result).toBe(undefined);
    });

    test('reduce() should handle empty array with initial value', async () => {
      const result = await AveAzul.reduce([], (acc, val) => acc + val, 10);
      expect(result).toBe(10);
    });

    test('reduce() should handle array with one element without initial value', async () => {
      const fn = jest.fn((acc, val) => acc === undefined ? val : acc + val);
      const result = await AveAzul.reduce([42], fn);
      expect(fn).toHaveBeenCalledWith(undefined, 42, 0, 1);
      expect(result).toBe(42);
    });

    test('reduce() should handle array with one element with initial value', async () => {
      const fn = jest.fn((acc, val) => acc + val);
      const result = await AveAzul.reduce([42], fn, 10);
      expect(fn).toHaveBeenCalledWith(10, 42, 0, 1);
      expect(result).toBe(52);
    });

    test('reduce() should handle array with multiple elements without initial value', async () => {
      const fn = jest.fn((acc, val) => acc === undefined ? val : acc + val);
      const result = await AveAzul.reduce([1, 2, 3], fn);
      expect(fn).toHaveBeenCalledTimes(3);
      expect(fn).toHaveBeenNthCalledWith(1, undefined, 1, 0, 3);
      expect(fn).toHaveBeenNthCalledWith(2, 1, 2, 1, 3);
      expect(fn).toHaveBeenNthCalledWith(3, 3, 3, 2, 3);
      expect(result).toBe(6);
    });

    test('reduce() should handle array with multiple elements with initial value', async () => {
      const fn = jest.fn((acc, val) => acc + val);
      const result = await AveAzul.reduce([1, 2, 3], fn, 10);
      expect(fn).toHaveBeenCalledTimes(3);
      expect(fn).toHaveBeenNthCalledWith(1, 10, 1, 0, 3);
      expect(fn).toHaveBeenNthCalledWith(2, 11, 2, 1, 3);
      expect(fn).toHaveBeenNthCalledWith(3, 13, 3, 2, 3);
      expect(result).toBe(16);
    });

    test('delay() should resolve after specified time', async () => {
      const start = Date.now();
      await AveAzul.delay(101);
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(100);
    });

    test('delay() should resolve with optional value', async () => {
      const result = await AveAzul.delay(50, 42);
      expect(result).toBe(42);
    });

    test('try() should handle synchronous functions', async () => {
      const result = await AveAzul.try(() => 42);
      expect(result).toBe(42);
    });

    test('try() should handle asynchronous functions', async () => {
      const result = await AveAzul.try(() => Promise.resolve(42));
      expect(result).toBe(42);
    });

    test('try() should handle errors', async () => {
      const promise = AveAzul.try(() => { throw new Error('test error'); });
      await expect(promise).rejects.toThrow('test error');
    });

    test('props() should resolve object properties', async () => {
      const result = await AveAzul.props({
        a: Promise.resolve(1),
        b: Promise.resolve(2),
        c: 3
      });
      
      expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });

    test('reduce() should reduce array elements', async () => {
      const result = await AveAzul.reduce([1, 2, 3, 4], (acc, val) => acc + val, 0);
      expect(result).toBe(10);
    });

    test('reduce() should work without initial value', async () => {
      const result = await AveAzul.reduce([1, 2, 3, 4], (acc, val) => acc + val, 0);
      expect(result).toBe(10);
    });

    test('throw() should return rejected promise', async () => {
      const promise = AveAzul.throw(new Error('test'));
      await expect(promise).rejects.toThrow('test');
    });

    test('promisify() should work with callback-style functions', async () => {
      const fn = (cb) => cb(null, 'success');
      const promisified = AveAzul.promisify(fn);
      const result = await promisified();
      expect(result).toBe('success');
    });

    test('promisify() should handle errors in callback-style functions', async () => {
      const error = new Error('test error');
      const fn = (cb) => cb(error);
      const promisified = AveAzul.promisify(fn);
      await expect(promisified()).rejects.toThrow(error);
    });

    test('promisify() should handle functions with multiple arguments', async () => {
      const fn = (a, b, cb) => cb(null, a + b);
      const promisified = AveAzul.promisify(fn);
      const result = await promisified(1, 2);
      expect(result).toBe(3);
    });

    test('promisify() should handle functions with no arguments', async () => {
      const original = function noArgs(cb) {};
      original.length = 1;
      original.name = 'noArgs';
      
      const promisified = AveAzul.promisify(original);
      
      expect(promisified.length).toBe(1);
      expect(promisified.name).toBe('noArgs');
    });

    test('promisify() should handle non-configurable properties', () => {
      const original = function testFn(cb) {};
      Object.defineProperty(original, 'nonConfigurable', {
        value: 'test',
        configurable: false,
        writable: false
      });
      
      // This should not throw even though the property can't be copied
      const promisified = AveAzul.promisify(original);
      expect(promisified).toBeDefined();
    });

    test('promisify() should throw on non-function arguments', () => {
      expect(() => AveAzul.promisify(null)).toThrow(TypeError);
      expect(() => AveAzul.promisify(undefined)).toThrow(TypeError);
      expect(() => AveAzul.promisify(42)).toThrow(TypeError);
      expect(() => AveAzul.promisify('not a function')).toThrow(TypeError);
      expect(() => AveAzul.promisify({})).toThrow(TypeError);
    });

    test('promisify() should handle context option', async () => {
      const obj = {
        value: 42,
        method(cb) { cb(null, this.value); }
      };
      const promisified = AveAzul.promisify(obj.method, { context: obj });
      const result = await promisified();
      expect(result).toBe(42);
    });

    test('promisify() should preserve properties from original function', () => {
      const original = function testFn(a, b, cb) {};
      original.someProperty = 'value';
      original.anotherProperty = 42;
      original.nested = {
        prop: 'nested value'
      };
      
      const promisified = AveAzul.promisify(original);
      
      // Test basic properties
      expect(promisified.someProperty).toBe('value');
      expect(promisified.anotherProperty).toBe(42);
      
      // Test nested properties
      expect(promisified.nested).toBeDefined();
      expect(promisified.nested.prop).toBe('nested value');
      
      // Test function properties
      expect(promisified.length).toBe(3); // Original function's length
      expect(promisified.name).toBe('testFn'); // Original function's name
      
      // Test that the promisified function still works
      expect(typeof promisified).toBe('function');
    });

    test('promisify() should preserve properties from fs.readFile-like functions', () => {
      const original = function readFile(path, options, cb) {};
      original.length = 3;
      original.name = 'readFile';
      
      const promisified = AveAzul.promisify(original);
      
      expect(promisified.length).toBe(3);
      expect(promisified.name).toBe('readFile');
    });

    test('promisify() should preserve properties from functions with no arguments', () => {
      const original = function noArgs(cb) {};
      original.length = 1;
      original.name = 'noArgs';
      
      const promisified = AveAzul.promisify(original);
      
      expect(promisified.length).toBe(1);
      expect(promisified.name).toBe('noArgs');
    });

    test('promisify() should handle multiArgs option', async () => {
      const obj = {
        method(cb) {
          cb(null, 'result1', 'result2');
        }
      };

      AveAzul.promisifyAll(obj, { multiArgs: true });

      const [result1, result2] = await obj.methodAsync();
      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
    });

    test('promisifyAll() should promisify all methods of an object', async () => {
      const obj = {
        method1(cb) {
          cb(null, 'result1');
        },
        method2(a, b, cb) {
          cb(null, a + b);
        },
        _privateMethod(cb) {
          cb(null, 'private');
        }
      };

      AveAzul.promisifyAll(obj);

      const result1 = await obj.method1Async();
      const result2 = await obj.method2Async(1, 2);

      expect(result1).toBe('result1');
      expect(result2).toBe(3);
      expect(obj._privateMethodAsync).toBeUndefined();
    });

    test('promisifyAll() should promisify all methods of a class prototype', async () => {
      class MyClass {
        method1(cb) {
          cb(null, 'result1');
        }
        method2(a, b, cb) {
          cb(null, a + b);
        }
        _privateMethod(cb) {
          cb(null, 'private');
        }
      }

      AveAzul.promisifyAll(MyClass);

      const instance = new MyClass();
      const result1 = await instance.method1Async();
      const result2 = await instance.method2Async(1, 2);

      expect(result1).toBe('result1');
      expect(result2).toBe(3);
      expect(instance._privateMethodAsync).toBeUndefined();
    });

    test('promisifyAll() should respect custom suffix option', async () => {
      const obj = {
        method(cb) {
          cb(null, 'result');
        }
      };

      AveAzul.promisifyAll(obj, { suffix: 'Promise' });

      const result = await obj.methodPromise();
      expect(result).toBe('result');
      expect(obj.methodAsync).toBeUndefined();
    });

    test('promisifyAll() should respect custom filter option', async () => {
      const obj = {
        method1(cb) {
          cb(null, 'result1');
        },
        method2(cb) {
          cb(null, 'result2');
        }
      };

      AveAzul.promisifyAll(obj, {
        filter: (name) => name === 'method1'
      });

      const result = await obj.method1Async();
      expect(result).toBe('result1');
      expect(obj.method2Async).toBeUndefined();
    });

    test('promisifyAll() should respect context option', async () => {
      const obj = {
        value: 42,
        method(a, b, cb) {
          cb(null, this.value + a + b);
        }
      };

      AveAzul.promisifyAll(obj, { context: obj });

      const result = await obj.methodAsync(1, 2);
      expect(result).toBe(45);
    });

    test('promisifyAll() should handle multiArgs option', async () => {
      const obj = {
        method(cb) {
          cb(null, 'result1', 'result2');
        }
      };

      AveAzul.promisifyAll(obj, { multiArgs: true });

      const [result1, result2] = await obj.methodAsync();
      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
    });

    test('promisifyAll() should handle excludeMain option', async () => {
      class MyClass {
        method(cb) {
          cb(null, 'result');
        }
      }

      AveAzul.promisifyAll(MyClass, { excludeMain: true });

      const instance = new MyClass();
      const result = await instance.methodAsync();
      expect(result).toBe('result');
      expect(MyClass.promisify).toBeUndefined();
      expect(MyClass.promisifyAll).toBeUndefined();
    });

    test('promisifyAll() should throw on invalid target', () => {
      expect(() => AveAzul.promisifyAll(null)).toThrow(TypeError);
      expect(() => AveAzul.promisifyAll(undefined)).toThrow(TypeError);
      expect(() => AveAzul.promisifyAll(42)).toThrow(TypeError);
    });

    test('promisifyAll() should throw when methods end in Async', () => {
      const obj = {
        method(cb) { cb(null, 'result'); },
        methodAsync(cb) { cb(null, 'result'); }
      };
      expect(() => AveAzul.promisifyAll(obj)).toThrow("Cannot promisify an API that has normal methods with 'Async'-suffix");
    });

    test('promisifyAll() should not promisify invalid JavaScript identifiers', () => {
      const obj = {
        '123method'(cb) { cb(null, 'result'); },
        'method-name'(cb) { cb(null, 'result'); },
        'method.name'(cb) { cb(null, 'result'); }
      };
      AveAzul.promisifyAll(obj);
      expect(obj['123methodAsync']).toBeUndefined();
      expect(obj['method-nameAsync']).toBeUndefined();
      expect(obj['method.nameAsync']).toBeUndefined();
    });

    test('promisifyAll() should not promisify constructor functions', () => {
      class MyClass {
        constructor() {}
        method(cb) { cb(null, 'result'); }
      }
      MyClass.prototype.someMethod = function() {};
      
      const obj = {
        MyClass,
        method(cb) { cb(null, 'result'); }
      };
      
      AveAzul.promisifyAll(obj);
      expect(obj.MyClassAsync).toBeUndefined();
      expect(obj.methodAsync).toBeDefined();
    });

    test('promisifyAll() should support custom promisifier', async () => {
      const obj = {
        method(a, b, cb) {
          cb(null, a + b);
        }
      };

      AveAzul.promisifyAll(obj, {
        promisifier: (fn) => {
          return (...args) => {
            return new AveAzul((resolve) => {
              fn(...args, (err, result) => {
                // Custom promisifier that ignores errors
                resolve(result * 2);
              });
            });
          };
        }
      });

      const result = await obj.methodAsync(2, 3);
      expect(result).toBe(10); // (2 + 3) * 2
    });

    test('promisifyAll() should return AveAzul instances', async () => {
      const obj = {
        method(cb) {
          cb(null, 'result1', 'result2');
        }
      };

      AveAzul.promisifyAll(obj, { multiArgs: true });

      const promise = obj.methodAsync();
      expect(promise).toBeInstanceOf(AveAzul);
      expect(promise).toBeInstanceOf(Promise);

      const [result1, result2] = await promise;
      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
    });

    test('promisifyAll() should handle multiArgs option with error', async () => {
      const error = new Error('test error');
      const obj = {
        method(cb) {
          cb(error);
        }
      };

      AveAzul.promisifyAll(obj, { multiArgs: true });

      await expect(obj.methodAsync()).rejects.toBe(error);
    });

    test('promisifyAll() should handle multiArgs option with custom promisifier', async () => {
      const obj = {
        method(cb) {
          cb(null, 'result1', 'result2', 'result3');
        }
      };

      AveAzul.promisifyAll(obj, {
        multiArgs: true,
        promisifier: (fn, context, multiArgs) => {
          return (...args) => {
            return new AveAzul((resolve, reject) => {
              args.push((err, ...results) => {
                if (err) reject(err);
                else resolve(results.map(r => r.toUpperCase()));
              });
              fn.apply(context, args);
            });
          };
        }
      });

      const promise = obj.methodAsync();
      expect(promise).toBeInstanceOf(AveAzul);
      const results = await promise;
      expect(results).toEqual(['RESULT1', 'RESULT2', 'RESULT3']);
    });

    test('defer() should create a deferred promise', async () => {
      const deferred = AveAzul.defer();
      expect(deferred.promise).toBeInstanceOf(AveAzul);
      expect(deferred.promise).toBeInstanceOf(Promise);
      expect(typeof deferred.resolve).toBe('function');
      expect(typeof deferred.reject).toBe('function');

      // Test resolving
      deferred.resolve(42);
      const result = await deferred.promise;
      expect(result).toBe(42);
    });
  });
}); 
