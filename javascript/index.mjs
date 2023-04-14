import { testinyApi } from "./testiny-api.mjs";

const testiny = testinyApi();

await testiny.selectProject("My Demo Project");
const testRun = await testiny.getTestRun("Staging Review 2");
console.log(testRun);
const cases = await testiny.getTestCasesForRun(testRun);
console.log(cases);

await testiny.updateResultsForRun(testRun, [
    [cases[0].id, "BLOCKED"],
    [cases[1].id, "PASSED"],
    [cases[2].id, "FAILED"],
    [cases[3].id, "NOTRUN"]
]);

