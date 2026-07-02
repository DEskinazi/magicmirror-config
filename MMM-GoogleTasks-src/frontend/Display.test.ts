import { AppearanceConfig } from "../types/Config";
import { getLoadingView } from "./Display";
import { getByText } from "@testing-library/dom";
import "@testing-library/jest-dom";

const displaySimple: AppearanceConfig = {
  dateFormat: "LLL do",
  ordering: "due",
  useRelativeDate: false
};

describe("Functions in display", function () {
  describe("getLoadingView", function () {
    it(`should return the loading view`, function () {
      const container = getLoadingView(displaySimple);
      const title = getByText(container, "Loading Google Tasks");
      expect(title).toHaveClass("wrapper");
    });
  });
});
