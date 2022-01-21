"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const mock_run_1 = require("azure-pipelines-task-lib/mock-run");
const TestUtils_1 = require("./TestUtils");
const taskPath = path.join(__dirname, "..", "maventask.js");
const taskRunner = new mock_run_1.TaskMockRunner(taskPath);
// Common initial setup
TestUtils_1.initializeTest(taskRunner);
// Set Inputs
const inputs = {
    mavenVersionSelection: "Default",
    mavenPOMFile: "pom.xml",
    options: "",
    goals: "package",
    javaHomeSelection: "JDKVersion",
    jdkVersion: "default",
    publishJUnitResults: true,
    testResultsFiles: "**/TEST-*.xml",
    mavenFeedAuthenticate: false
};
TestUtils_1.setInputs(taskRunner, inputs);
// Set up environment variables (task-lib does not support mocking getVariable)
// Env vars in the mock framework must replace '.' with '_'
delete process.env['M2_HOME']; // Remove in case process running this test has it already set
// Provide answers for task mock
const answers = {
    which: {
        mvn: "/home/bin/maven/bin/mvn"
    },
    checkPath: {
        "/home/bin/maven/bin/mvn": true,
        "pom.xml": true
    },
    exec: {
        "/home/bin/maven/bin/mvn -version": {
            code: 0,
            stdout: "Maven version 1.0.0"
        },
        "/home/bin/maven/bin/mvn -f pom.xml package": {
            code: 0,
            stdout: "Maven package done"
        },
    },
    findMatch: {
        "**/TEST-*.xml": [
            "/user/build/fun/test-123.xml"
        ]
    },
    exist: {
        [path.join(TestUtils_1.getTempDir(), ".mavenInfo")]: true
    }
};
taskRunner.setAnswers(answers);
// Run task
taskRunner.run();
