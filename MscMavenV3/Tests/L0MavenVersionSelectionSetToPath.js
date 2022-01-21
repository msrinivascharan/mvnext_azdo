"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const mock_run_1 = require("azure-pipelines-task-lib/mock-run");
const TestUtils_1 = require("./TestUtils");
const taskPath = path.join(__dirname, "..", "maventask.js");
const taskRunner = new mock_run_1.TaskMockRunner(taskPath);
// Common initial setup
TestUtils_1.initializeTest(taskRunner);
const mavenPath = "/home/bin/maven2/";
const mavenBin = path.join(mavenPath, "bin", "mvn");
// Set Inputs
const inputs = {
    mavenVersionSelection: "Path",
    mavenPath: mavenPath,
    mavenPOMFile: "pom.xml",
    options: "",
    goals: "package",
    javaHomeSelection: "JDKVersion",
    jdkVersion: "default",
    publishJUnitResults: true,
    testResultsFiles: "**/TEST-*.xml",
    mavenFeedAuthenticate: true
};
TestUtils_1.setInputs(taskRunner, inputs);
// Set up environment variables (task-lib does not support mocking getVariable)
// Env vars in the mock framework must replace '.' with '_'
delete process.env['M2_HOME']; // Remove in case process running this test has it already set
// Provide answers for task mock
const answers = {
    which: {
        mvn: mavenBin
    },
    checkPath: {
        [`${mavenPath}`]: true,
        [`${mavenBin}`]: true,
        "pom.xml": true
    },
    exec: {
        [`${mavenBin} -version`]: {
            code: 0,
            stdout: "Maven version 1.0.0"
        },
        [`${mavenBin} -f pom.xml help:effective-pom`]: {
            code: 0,
            stdout: '<Configuration>\r\n<project test>\r\n</project>\r\n</Configuration>\r\nEffective POMs, after inheritance, interpolation, and profiles are applied:\r\n\r\n<!-- ====================================================================== -->\r\n<!--                                                                        -->\r\n<!-- Generated by Maven Help Plugin on 2017-06-29T09:43:41                  -->\r\n<!-- See: http://maven.apache.org/plugins/maven-help-plugin/                -->\r\n<!--                                                                        -->\r\n<!-- ====================================================================== -->\r\n\r\n<!-- ====================================================================== -->\r\n<!--                                                                        -->\r\n<!-- Effective POM for project                                              -->\r\n<!-- \'com.microsoft.xplatalm:xplatalmApp:jar:1.0-SNAPSHOT\'                  -->\r\n<!--                                                                        -->\r\n<!-- ====================================================================== -->\r\n\r\n<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">\r\n</project>\r\n\r\n[INFO] ------------------------------------------------------------------------\r\n[INFO] BUILD SUCCESS\r\n[INFO] ------------------------------------------------------------------------\r\n[INFO] Total time: 0.927 s\r\n[INFO] Finished at: 2017-06-29T09:43:41-04:00\r\n[INFO] Final Memory: 7M/18M\r\n[INFO] ------------------------------------------------------------------------'
        },
        [`${mavenBin} -f pom.xml package`]: {
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
