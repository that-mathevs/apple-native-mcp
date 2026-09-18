import { FakeHelperFiles } from "../support/fake-helper-files.js";
import { helperFilesContract } from "./helper-files.contract.js";

// The fake stands in for the real files in every setup scenario, so it answers the same
// contract here.
helperFilesContract({
  name: "the fake helper files",
  build: () => Promise.resolve({ helperFiles: new FakeHelperFiles() }),
});
