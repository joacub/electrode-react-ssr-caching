"use strict";

// test profiling feature

const SSRProfiler = require("../..");
const renderGreeting = require("../gen-lib/render-greeting").default;
const renderBoard = require("../gen-lib/render-board").default;
const chai = require("chai");
const expect = chai.expect;
process.env.NODE_ENV = "production";

describe("SSRProfiler template caching", function () {

  beforeEach(() => {
    SSRProfiler.setCachingConfig({});
    SSRProfiler.clearCache();
    SSRProfiler.clearProfileData();
    SSRProfiler.enableCaching(false);
    SSRProfiler.enableProfiling(false);
  });

  function removeReactId(html) {
    const x = html.replace(/data-reactid\=\"[^\"]+\"/g, "");
    return x.replace(/data-react-checksum\=\"[^\"]+\"/g, "").replace(/ *>/g, ">");
  }

  const verifyRenderResults = (r1, r2, r3) => {
    chai.assert(r1 !== r2, "render1 and render2 should be different");
    chai.assert(r1 !== r3, "render1 and render3 should be different");
    chai.assert(r2 !== r3, "render2 and render3 should be different");
    r1 = removeReactId(r1);
    r2 = removeReactId(r2);
    r3 = removeReactId(r3);
    chai.assert(r1 === r2, "render1 and render2 should be the same");
    chai.assert(r1 === r3, "render1 and render3 should be the same");
    chai.assert(r2 === r3, "render2 and render3 should be the same");
  };

  //
  // test simple strategy with user provided function to generate cache key
  //
  it("should cache component with template strategy", function () {
    const message = "good morning";
    const r1 = renderGreeting("test", message);
    SSRProfiler.enableCaching();
    SSRProfiler.setCachingConfig({
      components: {
        "Hello": {
          strategy: "template",
          enable: true
        }
      }
    });
    // should add an entry to cache with template key
    SSRProfiler.stripUrlProtocol(true);
    SSRProfiler.setHashKey(false);
    renderGreeting("test", message);
    const key1 = Object.keys(SSRProfiler.cacheStore.cache)[0];
    const keyTmpl = key1.substr(6);
    const entry1 = SSRProfiler.cacheStore.getEntry("Hello", keyTmpl);
    expect(entry1.hits).to.equal(1);
    // should add an entry to cache with hashed key from template key
    SSRProfiler.setHashKey(true);
    const hashKey = SSRProfiler.hashKeyFn(keyTmpl);
    const r2 = renderGreeting("test", message);
    const entry = SSRProfiler.cacheStore.getEntry("Hello", hashKey);
    expect(entry.hits).to.equal(1);
    // now render should use result from cache
    const r3 = renderGreeting("test", message);
    expect(entry.hits).to.equal(2);
    expect(r2).includes(message);
    verifyRenderResults(r1, r2, r3);
    SSRProfiler.cacheHitReport();
    expect(SSRProfiler.cacheEntries()).to.equal(2);
    expect(SSRProfiler.cacheSize()).to.be.above(0);
  });

  const users = [
    {
      name: "Joel",
      message: "good morning",
      hasAvatar: true,
      quote: "blah",
      preserve: "preserve",
      empty: "",
      urls: [
        "http://zzzzl.com/xchen11",
        "https://github.com/jchip"
      ],
      data: {
        location: "SR",
        role: "dev",
        distance: 40
      },
      random: 1,
      f: () => 0
    },
    {
      name: "Alex",
      message: "how're you?",
      hasAvatar: false,
      quote: "let's do this",
      preserve: "preserve",
      urls: [
        "http://zzzzl.com/ag",
        "https://github.com/alex"
      ],
      data: {
        location: "SJ",
        role: "dir",
        distance: 20
      },
      random: 2,
      f: () => 0
    },
    {
      name: "Arpan",
      message: "how's your kitchen?",
      hasAvatar: true,
      quote: "what's up?",
      preserve: "preserve",
      urls: [
        "http://zzzzl.com/aa",
        "https://github.com/arpan"
      ],
      data: {
        location: "CV",
        role: "dev",
        distance: 30
      },
      random: 3,
      f: () => 0
    }
  ];

  const cacheConfig = {
    components: {
      "Heading": {
        strategy: "simple",
        enable: true
      },
      "Hello": {
        strategy: "simple",
        enable: true
      },
      "Board": {
        strategy: "template",
        enable: false
      },
      "InfoCard": {
        strategy: "template",
        enable: true,
        preserveKeys: ["preserve"],
        preserveEmptyKeys: ["empty"],
        whiteListNonStringKeys: ["random", "distance"]
      }
    }
  };

  const verifyAndRemoveUrlProtocol = (r) => {
    expect(r).includes("http://");
    expect(r).includes("https://");
    r = r.replace(/http:/g, "");
    r = r.replace(/https:/g, "");
    return r;
  };

  const testTemplate = (stripUrlProtocol, hashKeys, profiling) => {
    SSRProfiler.enableProfiling(profiling);
    const r1 = renderBoard(users);
    if (profiling) {
      const data = SSRProfiler.profileData;
      expect(data.Board[0].InfoCard[0].time).to.be.above(0);
      SSRProfiler.clearProfileData();
      SSRProfiler.enableProfiling(false);
    }
    SSRProfiler.enableCaching();
    SSRProfiler.setCachingConfig(cacheConfig);
    SSRProfiler.setHashKey(hashKeys);
    SSRProfiler.stripUrlProtocol(stripUrlProtocol);
    let r2 = renderBoard(users);
    const cache = SSRProfiler.cacheStore.cache;
    const keys = Object.keys(cache);
    keys.forEach((x) => {
      expect(cache[x].hits).to.equal(0);
    });
    SSRProfiler.enableProfiling(profiling);
    let r3 = renderBoard(users);
    if (profiling) {
      const data = SSRProfiler.profileData;
      expect(data.Board[0].InfoCard[0].time).to.be.above(0);
      SSRProfiler.clearProfileData();
    }
    expect(Object.keys(cache)).to.deep.equal(keys);
    keys.forEach((x) => {
      expect(cache[x].hits).to.equal(1);
    });
    if (!stripUrlProtocol) {
      r2 = verifyAndRemoveUrlProtocol(r2);
      r3 = verifyAndRemoveUrlProtocol(r3);
    }
    verifyRenderResults(r1, r2, r3);
  };

  it("should handle other scenarios for template cache", function () {
    testTemplate(false, false, false);
  });

  it("should handle template and strip url protocol", function () {
    testTemplate(true, true, true);
  });

  it("should support debug caching", function () {
    renderBoard(users);
    SSRProfiler.enableCaching();
    SSRProfiler.enableCachingDebug();
    expect(SSRProfiler.config.debug).to.equal(true);
    SSRProfiler.enableCachingDebug(false);
    expect(SSRProfiler.config.debug).to.equal(false);
    SSRProfiler.enableCachingDebug(true);
    expect(SSRProfiler.config.debug).to.equal(true);
    SSRProfiler.setCachingConfig(cacheConfig);
    SSRProfiler.setHashKey(false);
    const r2 = renderBoard(users);
    expect(r2).includes("<!-- component Board cacheType NONE");
    expect(r2).includes("<!-- component InfoCard cacheType cache");
    const r3 = renderBoard(users);
    expect(r3).includes("<!-- component Board cacheType NONE");
    expect(r3).includes("<!-- component InfoCard cacheType HIT");
  });

  it("should throw error for unknown caching strategy", function () {
    const config = JSON.parse(JSON.stringify(cacheConfig));
    config.components.Heading.strategy = "unknown";
    SSRProfiler.enableCaching();
    SSRProfiler.setCachingConfig(config);
    expect(() => renderBoard(users)).to.throw(Error, /Unknown caching strategy unknown for component Heading/);
  });
});