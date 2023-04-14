import fetch from 'node-fetch';

/** Testiny API library */
const TESTINY_PROD_URL = "https://app.testiny.io/";
let testinyBaseUrl = process.env.TESTINY_BASEURL ?? TESTINY_PROD_URL;
let testinyApiKey = process.env.TESTINY_APIKEY;

/** 
 * Create a new Testiny API instance. Optionally pass in the api key and the app base url. 
 * Defaults to using the TESTINY_APIKEY and TESTINY_BASEURL env var (or https://app.testiny.io/ if empty) 
*/
export const testinyApi = (apiKeyOpt, baseUrlOpt) => {
    if (apiKeyOpt) testinyApiKey = apiKeyOpt.toString().trim();
    if (baseUrlOpt) testinyBaseUrl = new URL(baseUrlOpt).toString();
    return {
        projectId: 0,
        /** Check that api key works with the Testiny endpoint - returns account information */
        async checkConnection() {
            const me = await request("account/me");
            return me.loggedIn && me;
        },
        /** Get a list of projects */
        async getProjects() {
            return (await request("project")).data;
        },
        /** Get a project by name or id */
        async getProject(idOrName) {
            let find;
            if (typeof idOrName === "number" || idOrName === undefined) {
                find = { id: idOrName ?? this.projectId };
            } else if (typeof idOrName === "string") {
                find = { filter: { name: idOrName } };
            } else throw new Error("Invalid argument");
            return (await request("project/find", {}, "post", find)).data[0];
        },
        /** Select a project by name or id. will be used in subsequent calls as the projet context */
        async selectProject(idOrNameOrProject) {
            if (this.projectId === 0) {
                await this.checkConnection();
            }
            if (typeof idOrNameOrProject === "object") {
                this.projectId = idOrNameOrProject.id ?? 0;
                return;
            }
            const project = await this.getProject(idOrNameOrProject);
            if (!project) throw new Error(`Project '${idOrNameOrProject}' was not found`);
            this.projectId = project.id;
        },
        /** Get a testrun by id or title */
        async getTestRun(idOrTitle) {
            let find;
            if (typeof idOrTitle === "number") {
                find = { id: idOrTitle, filter: { project_id: this.projectId } };
            } else if (typeof idOrTitle === "string") {
                find = { filter: { title: idOrTitle, project_id: this.projectId } };
            } else throw new Error("Invalid argument");
            return (await request("testrun/find", {}, "post", find)).data[0];
        },
        /** Get a list of test cases for given testrun (by id, title or object) */
        async getTestCasesForRun(idOrTitleOrRun) {
            const testRun = typeof idOrTitleOrRun !== "object"
                ? await this.getTestRun(idOrTitleOrRun) : idOrTitleOrRun;
            const find = {
                map: { entities: ["testcase", "testrun"], ids: [{ testrun_id: testRun.id }] }
            };
            return (await request("testcase/find", {}, "post", find)).data;
        },
        /** Update the results of test cases in a test run, given a list of [testcase id, result] tuples */
        async updateResultsForRun(idOrTitleOrRun, results) {
            const testRun = typeof idOrTitleOrRun !== "object"
                ? await this.getTestRun(idOrTitleOrRun) : idOrTitleOrRun;
            const mappings = listify(results).map(r => ({
                ids: {
                    testrun_id: testRun.id,
                    testcase_id: r.testcase_id ?? r.id ?? r[0],
                },
                mapped: {
                    result_status: guessResultStatus(r.result_status ?? r.result ?? r[1])
                }
            }));
            await request("testcase/mapping/bulk/testcase:testrun", { op: "update" }, "post", mappings);
        }
    }
};

function guessResultStatus(s) {
    if (s === null || s === undefined) return "NOTRUN";
    else if (s === false || s === 0) return "FAILED";
    else if (s === true || s === 1) return "PASSED";

    const r = s.toString().toUpperCase();
    if (r === "PASS" || r === "SUCCESS" || r === "OK") return "PASSED";
    else if (r === "FAIL" || r === "FAILURE" || r === "ERROR") return "FAILED";
    return r;
}

async function request(ep, query, method, body) {
    if (!testinyApiKey) throw new Error("TESTINY_APIKEY environment variable is not set");

    const resp = await fetch(formatUrl(ep, query), {
        method: method ?? "get",
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-cache",
        headers: {
            "x-api-key": testinyApiKey,
            "content-type": method == "post" || method === "put" ? "application/json" : undefined
        }
    });
    if (resp.status >= 400) {
        let errorBody;
        try {
            errorBody = await resp.json();
        } catch (err) {
            throw new Error("Invalid API response: " + err.message);
        }
        throw new Error(errorBody.message);
    }
    try {
        return await resp.json();
    } catch (err) {
        throw new Error("Invalid API response: " + err.message);
    }
}

function formatUrl(ep, params) {
    return new URL(testinyBaseUrl).toString() + "api/v1/" +
        (params && Object.keys(params).length > 0 ? `${ep}?${new URLSearchParams(params)}` : ep);
}

function listify(value) {
    return Array.isArray(value) ? value : [value]
}
