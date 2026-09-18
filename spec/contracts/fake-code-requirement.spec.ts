import { FakeCodeRequirement } from "../support/fake-code-requirement.js";
import { codeRequirementContract } from "./code-requirement.contract.js";

// The fake stands in for codesign in every setup scenario, so it answers the same contract here.
codeRequirementContract({
  name: "the fake code requirement",
  build: () => {
    const codeRequirement = new FakeCodeRequirement();
    const signedAsSomeoneElse = { path: "~/elsewhere/apple-native-mcp" };
    const missing = { path: "~/nowhere/apple-native-mcp" };

    codeRequirement.isNotMetBy(
      signedAsSomeoneElse.path,
      "code failed to satisfy specified code requirement(s)",
    );
    codeRequirement.isNotMetBy(missing.path, "No such file or directory");

    return Promise.resolve({
      codeRequirement,
      meeting: { path: "~/apple-native-mcp" },
      signedAsSomeoneElse,
      missing,
    });
  },
});
