import { testinyApi } from "./testiny-api.mjs";

const testiny = testinyApi();

await testiny.selectProject("My Project");
const testRun = await testiny.getTestRun("Release-Test 1.2.3");
const cases = await testiny.getTestCasesForRun(testRun);

await testiny.updateResultsForRun(testRun, [
    [cases[0].id, "BLOCKED"],
    [cases[1].id, "PASSED"],
    [cases[2].id, "FAILED"],
    [cases[3].id, "NOTRUN"]
]);

