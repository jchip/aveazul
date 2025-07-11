"use strict";

const AveAzul = require("./promise-lib");
const fs = require("fs");
const path = require("path");

describe("AveAzul.promisifyAll", () => {
  test("should promisify all methods of an object", async () => {
    const obj = {
      method1(cb) {
        cb(null, "result1");
      },
      method2(a, b, cb) {
        cb(null, a + b);
      },
      _privateMethod(cb) {
        cb(null, "private");
      },
    };

    AveAzul.promisifyAll(obj);

    const result1 = await obj.method1Async();
    const result2 = await obj.method2Async(1, 2);

    expect(result1).toBe("result1");
    expect(result2).toBe(3);
    expect(obj._privateMethodAsync).toBeUndefined();
  });

  test("should promisify all methods of a class prototype", async () => {
    class MyClass {
      method1(cb) {
        cb(null, "result1");
      }
      method2(a, b, cb) {
        cb(null, a + b);
      }
      _privateMethod(cb) {
        cb(null, "private");
      }
    }

    const instance = new MyClass();
    AveAzul.promisifyAll(instance);
    const result1 = await instance.method1Async();
    const result2 = await instance.method2Async(1, 2);

    expect(result1).toBe("result1");
    expect(result2).toBe(3);
    expect(instance._privateMethodAsync).toBeUndefined();
  });

  test("should respect custom suffix option", async () => {
    const obj = {
      method(cb) {
        cb(null, "result");
      },
    };

    AveAzul.promisifyAll(obj, { suffix: "Promise" });

    const result = await obj.methodPromise();
    expect(result).toBe("result");
    expect(obj.methodAsync).toBeUndefined();
  });

  test("should respect custom filter option", async () => {
    const obj = {
      method1(cb) {
        cb(null, "result1");
      },
      method2(cb) {
        cb(null, "result2");
      },
    };

    AveAzul.promisifyAll(obj, {
      filter: (name) => name === "method1",
    });

    const result = await obj.method1Async();
    expect(result).toBe("result1");
    expect(obj.method2Async).toBeUndefined();
  });

  test("should handle multiArgs option", async () => {
    const obj = {
      method(cb) {
        cb(null, "result1", "result2");
      },
    };

    AveAzul.promisifyAll(obj, { multiArgs: true });

    const [result1, result2] = await obj.methodAsync();
    expect(result1).toBe("result1");
    expect(result2).toBe("result2");
  });

  test("should throw on invalid target", () => {
    // expect(() => AveAzul.promisifyAll(null)).toThrow(TypeError);
    expect(() => AveAzul.promisifyAll(undefined)).toThrow(TypeError);
    expect(() => AveAzul.promisifyAll(42)).toThrow(TypeError);
  });

  test("should throw when methods end in Async", () => {
    const obj = {
      method(cb) {
        cb(null, "result");
      },
      methodAsync(cb) {
        cb(null, "result");
      },
    };
    expect(() => AveAzul.promisifyAll(obj)).toThrow(
      "Cannot promisify an API that has normal methods with 'Async'-suffix"
    );
  });

  test("should not promisify invalid JavaScript identifiers", () => {
    const obj = {
      "123method"(cb) {
        cb(null, "result");
      },
      "method-name"(cb) {
        cb(null, "result");
      },
      "method.name"(cb) {
        cb(null, "result");
      },
    };
    AveAzul.promisifyAll(obj);
    expect(obj["123methodAsync"]).toBeUndefined();
    expect(obj["method-nameAsync"]).toBeUndefined();
    expect(obj["method.nameAsync"]).toBeUndefined();
  });

  test("should support custom promisifier", async () => {
    const obj = {
      method(a, b, cb) {
        cb(null, a + b);
      },
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
      },
    });

    const result = await obj.methodAsync(2, 3);
    expect(result).toBe(10); // (2 + 3) * 2
  });

  test("should return AveAzul instances", async () => {
    const obj = {
      method(cb) {
        cb(null, "result1", "result2");
      },
    };

    AveAzul.promisifyAll(obj, { multiArgs: true });

    const promise = obj.methodAsync();
    expect(promise).toBeInstanceOf(AveAzul);

    const [result1, result2] = await promise;
    expect(result1).toBe("result1");
    expect(result2).toBe("result2");
  });

  test("should handle multiArgs option with error", async () => {
    const error = new Error("test error");
    const obj = {
      method(cb) {
        cb(error);
      },
    };

    AveAzul.promisifyAll(obj, { multiArgs: true });

    // bluebird rejects OperationError that wraps the error as cause
    await expect(obj.methodAsync()).rejects.toBeInstanceOf(Error);
  });

  test("should handle multiArgs option with custom promisifier", async () => {
    const obj = {
      method(cb) {
        cb(null, "result1", "result2", "result3");
      },
    };

    AveAzul.promisifyAll(obj, {
      multiArgs: true,
      promisifier: (fn, context, multiArgs) => {
        return (...args) => {
          return new AveAzul((resolve, reject) => {
            args.push((err, ...results) => {
              if (err) reject(err);
              else resolve(results.map((r) => r.toUpperCase()));
            });
            fn.apply(context, args);
          });
        };
      },
    });

    const promise = obj.methodAsync();
    expect(promise).toBeInstanceOf(AveAzul);
    const results = await promise;
    expect(results).toEqual(["RESULT1", "RESULT2", "RESULT3"]);
  });

  test("should throw RangeError when suffix is not a valid identifier", () => {
    const obj = {
      method(cb) {
        cb(null, "result");
      },
    };

    expect(() => AveAzul.promisifyAll(obj, { suffix: "Invalid-Suffix" })).toThrow(RangeError);
    expect(() => AveAzul.promisifyAll(obj, { suffix: "123" })).toThrow(RangeError);
    expect(() => AveAzul.promisifyAll(obj, { suffix: "$valid" })).not.toThrow();
  });

  test("should handle methods in standard prototypes like Array", () => {
    // Try to promisify an array
    const arr = [1, 2, 3];
    AveAzul.promisifyAll(arr);

    // Array's standard methods should not have Async versions
    expect(arr.mapAsync).toBeUndefined();
    expect(arr.filterAsync).toBeUndefined();
    expect(arr.forEachAsync).toBeUndefined();
    expect(arr.reduceAsync).toBeUndefined();

    // Create a custom object with an Array property
    const objWithArrayProp = {
      myArray: arr,
      arrayMethod(cb) {
        cb(null, this.myArray);
      },
    };

    // The object itself should be promisified, but not affect the Array
    AveAzul.promisifyAll(objWithArrayProp);
    expect(objWithArrayProp.arrayMethodAsync).toBeDefined();
    expect(typeof objWithArrayProp.arrayMethodAsync).toBe("function");

    // Array methods should still not be promisified
    expect(arr.mapAsync).toBeUndefined();
  });

  test("should not promisify methods of a class that extends Array", () => {
    // Create a class that extends Array
    class MyArray extends Array {
      myCustomMethod(cb) {
        cb(null, this.length);
      }
    }

    const myArr = new MyArray(1, 2, 3);
    AveAzul.promisifyAll(myArr);

    // The standard Array methods should not have Async versions
    expect(myArr.mapAsync).toBeUndefined();
    expect(myArr.filterAsync).toBeUndefined();

    // But custom methods should be promisified
    expect(myArr.myCustomMethodAsync).toBeDefined();
  });

  test("should have no effect when called multiple times on the same object", async () => {
    const obj = {
      method(cb) {
        cb(null, "result");
      },
      otherMethod(a, cb) {
        cb(null, a + 1);
      },
    };

    // First promisification
    AveAzul.promisifyAll(obj);

    // Capture the state after first promisification
    const methodAsync = obj.methodAsync;
    const otherMethodAsync = obj.otherMethodAsync;
    const properties = Object.getOwnPropertyNames(obj);

    // Second promisification
    AveAzul.promisifyAll(obj);

    // Verify no new properties were added
    const newProperties = Object.getOwnPropertyNames(obj);
    expect(newProperties).toEqual(properties);

    // Verify methods are the same objects (idempotent operation)
    expect(obj.methodAsync).toBe(methodAsync);
    expect(obj.otherMethodAsync).toBe(otherMethodAsync);

    // Verify the methods still function correctly
    const result1 = await obj.methodAsync();
    expect(result1).toBe("result");

    const result2 = await obj.otherMethodAsync(5);
    expect(result2).toBe(6);
  });

  test("should preserve 'this' binding in promisified methods", async () => {
    // Object with methods that use 'this'
    const obj = {
      name: "test-object",
      value: 42,

      getName(cb) {
        cb(null, this.name);
      },

      getValue(cb) {
        cb(null, this.value);
      },

      setValues(newName, newValue, cb) {
        this.name = newName;
        this.value = newValue;
        cb(null, { name: this.name, value: this.value });
      },
    };

    // Promisify all methods
    AveAzul.promisifyAll(obj);

    // Verify 'this' is preserved in promisified methods
    const name = await obj.getNameAsync();
    expect(name).toBe("test-object");

    const value = await obj.getValueAsync();
    expect(value).toBe(42);

    // Verify 'this' is modified correctly in promisified methods
    const result = await obj.setValuesAsync("new-name", 100);
    expect(result).toEqual({ name: "new-name", value: 100 });
    expect(obj.name).toBe("new-name");
    expect(obj.value).toBe(100);
  });

  test("should promisify fs object methods", async () => {
    // Create a copy of fs to avoid modifying the original
    const fsCopy = { ...fs };

    // Promisify all fs methods
    AveAzul.promisifyAll(fsCopy);

    // Test that readFile is promisified
    expect(fsCopy.readFileAsync).toBeDefined();
    expect(typeof fsCopy.readFileAsync).toBe("function");

    // Test that writeFile is promisified
    expect(fsCopy.writeFileAsync).toBeDefined();
    expect(typeof fsCopy.writeFileAsync).toBe("function");

    // Test that stat is promisified
    expect(fsCopy.statAsync).toBeDefined();
    expect(typeof fsCopy.statAsync).toBe("function");

    // Test that opendir is promisified
    expect(fsCopy.opendirAsync).toBeDefined();
    expect(typeof fsCopy.opendirAsync).toBe("function");

    // Test reading package.json file
    const packageJsonPath = path.join(__dirname, "..", "package.json");
    const content = await fsCopy.readFileAsync(packageJsonPath, "utf8");

    // Parse and verify it's a valid JSON with expected properties
    const packageJson = JSON.parse(content);
    expect(packageJson.name).toBe("aveazul");
    expect(packageJson.description).toContain("Bluebird");

    // Test that promisified methods return AveAzul instances
    const promise = fsCopy.readFileAsync(packageJsonPath, "utf8");
    expect(promise).toBeInstanceOf(AveAzul);

    // Test stat functionality
    const stats = await fsCopy.statAsync(packageJsonPath);
    expect(stats.isFile()).toBe(true);
    expect(stats.size).toBeGreaterThan(0);

    // Test Dir object promisification
    const testDir = path.join(__dirname, "..");
    const dir = await fsCopy.opendirAsync(testDir);

    // Test that Dir.read is promisified
    expect(dir.readAsync).toBeDefined();
    expect(typeof dir.readAsync).toBe("function");

    // Test that Dir.close is promisified
    expect(dir.closeAsync).toBeDefined();
    expect(typeof dir.closeAsync).toBe("function");

    // Test reading a directory entry
    const dirent = await dir.readAsync();
    if (dirent) {
      // Dirent should have synchronous methods like isFile(), isDirectory()
      expect(typeof dirent.isFile).toBe("function");
      expect(typeof dirent.isDirectory).toBe("function");
      expect(typeof dirent.name).toBe("string");

      // Test that Dirent methods work
      const isFile = dirent.isFile();
      const isDirectory = dirent.isDirectory();
      expect(typeof isFile).toBe("boolean");
      expect(typeof isDirectory).toBe("boolean");
    }

    // Close the directory
    await dir.closeAsync();

    // Verify original fs object is not modified
    expect(fs.readFileAsync).toBeUndefined();
    expect(fs.writeFileAsync).toBeUndefined();
    expect(fs.statAsync).toBeUndefined();
    expect(fs.opendirAsync).toBeUndefined();
  });
});
