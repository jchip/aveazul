"use strict";

const AveAzul = require("./promise-lib");

describe("AveAzul.using", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should manage a single resource with cleanup", async () => {
    const resource = { value: "test resource", disposed: false };
    let resourceUsed = false;

    // expect the disposer to receive the resource from the promise
    const disposer = AveAzul.resolve(resource).disposer((_res) => {
      _res.disposed = true;
    });

    const result = await AveAzul.using([disposer], (res) => {
      resourceUsed = true;
      expect(res[0]).toBe(resource);
      expect(res[0].disposed).toBe(false);
      return "success";
    });

    expect(resourceUsed).toBe(true);
    expect(resource.disposed).toBe(true);
    expect(result).toBe("success");
  });

  test("should manage multiple resources using array syntax with cleanup", async () => {
    const resources = [
      { id: 1, disposed: false },
      { id: 2, disposed: false },
      { id: 3, disposed: false },
    ];

    const disposers = resources.map((res) =>
      AveAzul.resolve(res).disposer((_res) => {
        _res.disposed = true;
      })
    );

    let resourcesUsed = false;

    const result = await AveAzul.using(disposers, (resArray) => {
      resourcesUsed = true;
      expect(resArray[0]).toBe(resources[0]);
      expect(resArray[1]).toBe(resources[1]);
      expect(resArray[2]).toBe(resources[2]);
      expect(resArray[0].disposed).toBe(false);
      expect(resArray[1].disposed).toBe(false);
      expect(resArray[2].disposed).toBe(false);
      return "success";
    });

    expect(resourcesUsed).toBe(true);
    expect(resources[0].disposed).toBe(true);
    expect(resources[1].disposed).toBe(true);
    expect(resources[2].disposed).toBe(true);
    expect(result).toBe("success");
  });

  function setupCleanupOrderTest() {
    const cleanupOrder = [];

    const resource1 = { id: 1 };
    const resource2 = { id: 2 };
    const resource3 = { id: 3 };

    const disposer1 = AveAzul.resolve(resource1).disposer(() => {
      return AveAzul.delay(Math.random() * 200).then(() =>
        cleanupOrder.push(1)
      );
    });

    const disposer2 = AveAzul.resolve(resource2).disposer(() => {
      cleanupOrder.push(2);
    });

    const disposer3 = AveAzul.resolve(resource3).disposer(() => {
      return AveAzul.delay(Math.random() * 200).then(() =>
        cleanupOrder.push(3)
      );
    });
    return { cleanupOrder, disposer1, disposer2, disposer3 };
  }

  test("should cleanup resources using array syntax in order of acquisition", async () => {
    const { cleanupOrder, disposer1, disposer2, disposer3 } =
      setupCleanupOrderTest();

    await AveAzul.using([disposer1, disposer2, disposer3], () => "success");

    // Resources should be cleaned up in reverse order of acquisition
    expect(cleanupOrder).toEqual([1, 2, 3]);
  });

  test("should cleanup resources using ...args syntax in order of acquisition", async () => {
    const { cleanupOrder, disposer1, disposer2, disposer3 } =
      setupCleanupOrderTest();

    await AveAzul.using(disposer1, disposer2, disposer3, () => "success");

    // Resources should be cleaned up in reverse order of acquisition
    expect(cleanupOrder).toEqual([1, 2, 3]);
  });

  test("should clean up resources when handler throws", async () => {
    const resource = { disposed: false };
    const disposer = AveAzul.resolve(resource).disposer(() => {
      resource.disposed = true;
    });

    const error = new Error("Test error");

    await expect(
      // test using ...args syntax with a single disposer
      AveAzul.using(disposer, () => {
        throw error;
      })
    ).rejects.toThrow(error);

    expect(resource.disposed).toBe(true);
  });

  test("should clean up resources when handler returns rejected promise", async () => {
    const resource = { disposed: false };
    const disposer = AveAzul.resolve(resource).disposer(() => {
      resource.disposed = true;
    });

    const error = new Error("Test error");

    await expect(
      AveAzul.using([disposer], () => {
        return Promise.reject(error);
      })
    ).rejects.toThrow(error);

    expect(resource.disposed).toBe(true);
  });

  test("should handle disposer acquisition failure", async () => {
    const resource = { disposed: false };
    const acquisitionError = new Error("Resource acquisition failed");

    // Create a disposer that will reject during acquisition
    const failingDisposer = AveAzul.reject(acquisitionError).disposer(() => {
      resource.disposed = true;
    });

    // Create a second disposer that should never be acquired
    const secondResource = { disposed: false };
    const secondDisposer = AveAzul.resolve(secondResource).disposer(() => {
      secondResource.disposed = true;
    });

    const result = AveAzul.using([failingDisposer, secondDisposer], () => {
      return "success";
    });
    // Attempt to use both disposers
    await expect(result).rejects.toThrow(acquisitionError);

    // Verify that neither resource was disposed since acquisition failed
    expect(resource.disposed).toBe(false);
    expect(secondResource.disposed).toBe(true);
  });

  test("should clean up acquired resources even a later promise resource rejects", async () => {
    let disposed = false;
    const resource = { value: "test resource" };

    // Create a disposer that will signal when cleanup happens
    const disposer = AveAzul.resolve(resource).disposer(() => {
      disposed = true;
    });

    const reject1 = () =>
      Promise.reject(new Error("Resource acquisition failed"));
    const reject2 = () =>
      AveAzul.delay(50).then(() =>
        AveAzul.reject(new Error("Resource 2 acquisition failed"))
      );

    // Now create an array with our disposer followed by a rejected promise
    const disposers = [disposer, reject1(), reject2()];

    let err1;

    // Catch the error here to prevent test failure
    const res = await AveAzul.using(disposers, () => "success").catch((err) => {
      err1 = err;
    });

    expect(res).toBeUndefined();
    // Now verify that cleanup happened
    expect(disposed).toBe(true);
    expect(err1).toBeInstanceOf(Error);
  });

  test("should clean up acquired resources even an earlier promise resource rejects", async () => {
    let disposed = false;
    const resource = { value: "test resource" };

    // Create a disposer that will signal when cleanup happens
    const disposer = AveAzul.resolve(resource).disposer(() => {
      disposed = true;
    });

    const reject1 = () =>
      Promise.reject(new Error("Resource acquisition failed"));
    const reject2 = () =>
      AveAzul.delay(50).then(() =>
        AveAzul.reject(new Error("Resource 2 acquisition failed"))
      );

    // Now create an array with our disposer followed by a rejected promise
    const disposers = [reject1(), disposer, reject2()];

    let err1;

    // Catch the error here to prevent test failure
    const res = await AveAzul.using(disposers, () => "success").catch((err) => {
      err1 = err;
    });

    expect(res).toBeUndefined();
    // Now verify that cleanup happened
    expect(disposed).toBe(true);
    expect(err1).toBeInstanceOf(Error);
  });

  test("should work with non-promise values", async () => {
    const disposed = { value: false };

    const disposer = AveAzul.method(() => {
      return {
        value: "test",
        _disposer: () => {
          disposed.value = true;
        },
      };
    })().disposer((resource) => resource._disposer());

    const result = await AveAzul.using([disposer], (resources) => {
      expect(resources[0].value).toBe("test");
      return "success";
    });

    expect(result).toBe("success");
    expect(disposed.value).toBe(true);
  });

  test("should work with synchronous handlers", async () => {
    const resource = { disposed: false };
    const disposer = AveAzul.resolve(resource).disposer(() => {
      resource.disposed = true;
    });

    const result = await AveAzul.using([disposer], (resources) => {
      return "sync result";
    });

    expect(result).toBe("sync result");
    expect(resource.disposed).toBe(true);
  });

  test("should work with nested using calls", async () => {
    const resources = [
      { id: "outer", disposed: false },
      { id: "inner", disposed: false },
    ];

    const outerDisposer = AveAzul.resolve(resources[0]).disposer(() => {
      resources[0].disposed = true;
    });

    const innerDisposer = AveAzul.resolve(resources[1]).disposer(() => {
      resources[1].disposed = true;
    });

    const result = await AveAzul.using(
      [outerDisposer],
      async (outerResources) => {
        expect(outerResources[0]).toBe(resources[0]);

        return AveAzul.using([innerDisposer], (innerResources) => {
          expect(innerResources[0]).toBe(resources[1]);
          return "nested success";
        });
      }
    );

    expect(result).toBe("nested success");
    expect(resources[0].disposed).toBe(true);
    expect(resources[1].disposed).toBe(true);
  });

  test("should handle async disposer functions", async () => {
    let disposed = false;
    const resource = { value: "test" };

    // Use a different approach to ensure the async cleanup completes
    const cleanupPromise = new Promise((resolve) => {
      const disposer = AveAzul.resolve(resource).disposer(async () => {
        await new Promise((r) => setTimeout(r, 10));
        disposed = true;
        resolve(); // Signal that cleanup is done
      });

      AveAzul.using([disposer], () => "success");
    });

    // Wait for cleanup to complete
    await cleanupPromise;
    expect(disposed).toBe(true);
  });

  test("should pass the resource to the cleanup function", async () => {
    const resource = { value: "test", cleaned: false };

    const disposer = AveAzul.resolve(resource).disposer((res) => {
      expect(res).toBe(resource);
      res.cleaned = true;
    });

    await AveAzul.using([disposer], () => "success");

    expect(resource.cleaned).toBe(true);
  });

  test("should work with diposer and other types of resources", async () => {
    const resource1 = { id: "aveazul", disposed: false };

    // Using AveAzul promise
    const disposer1 = AveAzul.resolve(resource1).disposer(() => {
      resource1.disposed = true;
    });

    // Using native Promise
    const promise2 = Promise.resolve("foobar");
    const result = [];
    const res = await AveAzul.using(
      "hello world",
      disposer1,
      promise2,
      (a, b, c) => {
        result.push(a, b, c);
        return "success";
      }
    );

    expect(res).toBe("success");
    expect(resource1.disposed).toBe(true);
    expect(result).toEqual(["hello world", resource1, "foobar"]);
  });

  test("should handle a practical example like file operations with mocks", async () => {
    // Mock file system operations
    const mockFS = {
      openFile: jest.fn().mockResolvedValue({
        fileHandle: 123,
        path: "/path/to/file.txt",
      }),
      readFile: jest.fn().mockImplementation((file) => {
        return Promise.resolve(`Content of ${file.path}`);
      }),
      closeFile: jest.fn().mockResolvedValue(undefined),
    };

    // Function to create a disposer for file handles
    const getFileDisposer = (path) => {
      return mockFS
        .openFile(path)
        .then((fileHandle) =>
          AveAzul.resolve(fileHandle).disposer(() =>
            mockFS.closeFile(fileHandle)
          )
        );
    };

    // Get the file disposer first to ensure it's resolved before using
    const fileDisposer = await getFileDisposer("/path/to/file.txt");

    const result = await AveAzul.using([fileDisposer], async (resources) => {
      // The resource should already be resolved now
      const file = resources[0];
      const content = await mockFS.readFile(file);
      return content;
    });

    expect(result).toBe("Content of /path/to/file.txt");
    expect(mockFS.openFile).toHaveBeenCalledWith("/path/to/file.txt");
    expect(mockFS.readFile).toHaveBeenCalledWith({
      fileHandle: 123,
      path: "/path/to/file.txt",
    });
    expect(mockFS.closeFile).toHaveBeenCalledWith({
      fileHandle: 123,
      path: "/path/to/file.txt",
    });
  });

  test("should handle error when acquiring from promise-like resource", async () => {
    const acquisitionError = new Error(
      "Promise-like resource acquisition failed"
    );

    // Create two resources: one that succeeds and one that fails
    const successResource = { disposed: false };
    const successDisposer = AveAzul.resolve(successResource).disposer(() => {
      successResource.disposed = true;
    });

    // Create a failing promise-like object
    const failingPromiseLike = {
      then: function (resolve, reject) {
        reject(acquisitionError);
        return this;
      },
      catch: function (onReject) {
        onReject(acquisitionError);
        return this;
      },
    };

    // Try to use both resources
    await expect(
      AveAzul.using([successDisposer, failingPromiseLike], () => "success")
    ).rejects.toThrow(acquisitionError);

    // Verify the successful resource was disposed even though the acquisition failed
    expect(successResource.disposed).toBe(true);
  });

  test("should wait for handler to complete before calling dispose functions", async () => {
    // Create a sequence tracker to monitor the order of operations
    const sequence = [];

    const resource = { value: "test resource", disposed: false };

    // Create a disposer that records when disposal happens
    const disposer = AveAzul.resolve(resource).disposer(() => {
      sequence.push("dispose called");
      resource.disposed = true;
    });

    await AveAzul.using([disposer], async () => {
      // Record that we're in the handler
      sequence.push("handler started");

      // Use a delay to simulate async operations in the handler
      await AveAzul.delay(50);

      // Record that the handler is about to complete
      sequence.push("handler finishing");

      return "done";
    });

    // Verify that disposal happened AFTER the handler completed
    expect(sequence).toEqual([
      "handler started",
      "handler finishing",
      "dispose called",
    ]);

    // Also verify the resource was properly disposed
    expect(resource.disposed).toBe(true);
  });

  test("should handle a promise that resolves to a disposer", async () => {
    const Promise = require("bluebird");

    // A simple resource class for testing
    class Resource {
      constructor(name) {
        this.name = name;
        this.disposed = false;
      }

      dispose() {
        this.disposed = true;
      }

      disposer() {
        return AveAzul.resolve(this).disposer((r) => r.dispose());
      }

      bluebirdDisposer() {
        return Promise.resolve(this).disposer((r) => r.dispose());
      }
    }

    // Test how AveAzul handles a promise that resolves to a disposer
    const aveazulResource = new Resource("AveAzul");
    // Create a function that returns a promise resolving to a disposer
    const getAveAzulPromiseToDisposer = () => {
      return AveAzul.resolve(aveazulResource.disposer());
    };

    await AveAzul.using(getAveAzulPromiseToDisposer(), (resource) => {
      expect(resource.name).toBe("AveAzul");
      expect(resource.disposed).toBe(false);
    });

    expect(aveazulResource.disposed).toBe(true);

    // Test how Bluebird handles a promise that resolves to a disposer
    const bluebirdResource = new Resource("Bluebird");
    // Create a function that returns a promise resolving to a disposer
    const getBluebirdPromiseToDisposer = () => {
      return Promise.resolve(bluebirdResource.bluebirdDisposer());
    };

    await Promise.using(getBluebirdPromiseToDisposer(), (resource) => {
      expect(resource.name).toBe("Bluebird");
      expect(resource.disposed).toBe(false);
    });

    expect(bluebirdResource.disposed).toBe(true);
  });

  test("should compare direct disposer vs promise-to-disposer behavior", async () => {
    const Promise = require("bluebird");

    // A simple resource class for testing
    class Resource {
      constructor(name) {
        this.name = name;
        this.disposed = false;
        this.usedIn = [];
      }

      use(context) {
        this.usedIn.push(context);
      }

      dispose() {
        this.disposed = true;
      }

      disposer() {
        return AveAzul.resolve(this).disposer((r) => r.dispose());
      }

      bluebirdDisposer() {
        return Promise.resolve(this).disposer((r) => r.dispose());
      }
    }

    // Test with AveAzul - direct disposer vs promise-to-disposer
    const aveResource1 = new Resource("AveAzul-Direct");
    const aveDirectDisposer = aveResource1.disposer();

    const aveResource2 = new Resource("AveAzul-Promised");
    const avePromiseToDisposer = AveAzul.resolve(aveResource2.disposer());

    await AveAzul.using(aveDirectDisposer, avePromiseToDisposer, (r1, r2) => {
      r1.use("direct");
      r2.use("promised");
    });

    expect(aveResource1.disposed).toBe(true);
    expect(aveResource2.disposed).toBe(true);
    expect(aveResource1.usedIn).toContain("direct");
    expect(aveResource2.usedIn).toContain("promised");

    // Test with Bluebird - direct disposer vs promise-to-disposer
    const bbResource1 = new Resource("Bluebird-Direct");
    const bbDirectDisposer = bbResource1.bluebirdDisposer();

    const bbResource2 = new Resource("Bluebird-Promised");
    const bbPromiseToDisposer = Promise.resolve(bbResource2.bluebirdDisposer());

    await Promise.using(bbDirectDisposer, bbPromiseToDisposer, (r1, r2) => {
      r1.use("direct");
      r2.use("promised");
    });

    expect(bbResource1.disposed).toBe(true);
    expect(bbResource2.disposed).toBe(true);
    expect(bbResource1.usedIn).toContain("direct");
    expect(bbResource2.usedIn).toContain("promised");
  });
});
