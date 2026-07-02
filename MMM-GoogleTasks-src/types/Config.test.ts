import { isDataConfig } from "./Config";
import "@testing-library/jest-dom";

const goodDataConfig = {
  credentialPath: "/path/to/credentials.json",
  tokenPath: "/path/to/token.json",
  showCompleted: false,
  maxResults: 10,
  plannedTasks: {},
  accounts: []
};

const badDataConfig = {};

describe("Functions in display", function () {
  describe("isDataConfig", function () {
    it(`should return true for good config`, function () {
      expect(isDataConfig(goodDataConfig)).toBe(true);
    });

    it(`should return false for bad config`, function () {
      expect(isDataConfig(badDataConfig)).toBe(false);
    });

    it(`should return false for undefined`, function () {
      expect(isDataConfig(undefined)).toBe(false);
    });
  });
});
