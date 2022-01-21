"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const mock_run_1 = require("azure-pipelines-task-lib/mock-run");
const TestUtils_1 = require("./TestUtils");
const taskPath = path.join(__dirname, '..', 'maventask.js');
const taskRunner = new mock_run_1.TaskMockRunner(taskPath);
// Common initial setup
TestUtils_1.initializeTest(taskRunner);
// Set Inputs
const inputs = {
    mavenVersionSelection: 'Default',
    mavenPOMFile: 'pom.xml',
    options: '',
    goals: 'package',
    javaHomeSelection: 'JDKVersion',
    jdkVersion: 'default',
    publishJUnitResults: true,
    testResultsFiles: '**/TEST-*.xml',
    mavenOpts: '-Xmx2048m',
    checkstyleAnalysisEnabled: false,
    pmdAnalysisEnabled: false,
    findbugsAnalysisEnabled: false,
    mavenFeedAuthenticate: true,
    codeCoverageTool: 'JaCoCo',
    restoreOriginalPomXml: true
};
TestUtils_1.setInputs(taskRunner, inputs);
// Set up environment variables (task-lib does not support mocking getVariable)
// Env vars in the mock framework must replace '.' with '_'
delete process.env.M2_HOME; // Remove in case process running this test has it already set
// Provide answers for task mock
const answers = {
    which: {
        mvn: '/home/bin/maven/bin/mvn'
    },
    checkPath: {
        '/home/bin/maven/bin/mvn': true,
        'pom.xml': true
    },
    exec: {
        '/home/bin/maven/bin/mvn -version': {
            code: 0,
            stdout: 'Maven version 1.0.0'
        },
        '/home/bin/maven/bin/mvn -f pom.xml help:effective-pom': {
            code: 0,
            stdout: '<Configuration>\r\n<project test>\r\n</project>\r\n</Configuration>\r\nEffective POMs, after inheritance, interpolation, and profiles are applied:\r\n\r\n<!-- ====================================================================== -->\r\n<!--                                                                        -->\r\n<!-- Generated by Maven Help Plugin on 2017-06-29T09:43:41                  -->\r\n<!-- See: http://maven.apache.org/plugins/maven-help-plugin/                -->\r\n<!--                                                                        -->\r\n<!-- ====================================================================== -->\r\n\r\n<!-- ====================================================================== -->\r\n<!--                                                                        -->\r\n<!-- Effective POM for project                                              -->\r\n<!-- \'com.microsoft.xplatalm:xplatalmApp:jar:1.0-SNAPSHOT\'                  -->\r\n<!--                                                                        -->\r\n<!-- ====================================================================== -->\r\n\r\n<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">\r\n</project>\r\n\r\n[INFO] ------------------------------------------------------------------------\r\n[INFO] BUILD SUCCESS\r\n[INFO] ------------------------------------------------------------------------\r\n[INFO] Total time: 0.927 s\r\n[INFO] Finished at: 2017-06-29T09:43:41-04:00\r\n[INFO] Final Memory: 7M/18M\r\n[INFO] ------------------------------------------------------------------------'
        },
        '/home/bin/maven/bin/mvn -f pom.xml clean package': {
            code: 0,
            stdout: 'Maven package done'
        },
        '/home/bin/maven/bin/mvn -f CCReportPomA4D283EG.xml verify -Dmaven.test.skip=true': {
            code: 0,
            stdout: 'something'
        }
    },
    findMatch: {
        '**/TEST-*.xml': [
            '/user/build/fun/test-123.xml'
        ]
    },
    exist: {
        [path.join(TestUtils_1.getTempDir(), '.mavenInfo')]: true,
        [path.join('CCReport43F6D5EF', 'jacoco.xml')]: true,
        'CCReportPomA4D283EG.xml': true
    },
    rmRF: {
        target: { success: true },
        CCReport43F6D5EF: { success: true },
        'CCReportPomA4D283EG.xml': { success: true }
    }
};
taskRunner.setAnswers(answers);
taskRunner.registerMock('azure-pipelines-tasks-codecoverage-tools/codecoveragefactory', {
    CodeCoverageEnablerFactory: class {
        getTool(buildTool, ccTool) {
            if (buildTool.toLowerCase() !== 'maven' || ccTool.toLowerCase() !== 'jacoco') {
                throw new Error(`Should use maven-jacoco but called ${buildTool}-${ccTool}`);
            }
            return {
                enableCodeCoverage() {
                    console.log('Writing modified pom.xml contents');
                    return Promise.resolve(true);
                }
            };
        }
    }
});
const originalPomXmlContents = 'original pom.xml contents';
const fsClone = Object.assign({}, fs);
Object.assign(fsClone, {
    readFileSync(filename, encoding) {
        if (filename === 'pom.xml' && encoding === 'utf8') {
            console.log('Reading original pom.xml');
            return originalPomXmlContents;
        }
        return fs.readFileSync(filename, encoding);
    },
    writeFileSync(filename, data) {
        if (filename === 'pom.xml') {
            if (data === originalPomXmlContents) {
                console.log('Writing original pom.xml contents');
                return;
            }
            throw new Error(`Trying to write unknown data into pom.xml; data=${data}`);
        }
        fs.writeFileSync(filename, data);
    }
});
taskRunner.registerMock('fs', fsClone);
// We only register this mock to prevent import conflicts with already mocked fs
taskRunner.registerMock('fs-extra', {
    mkdirpSync(dir) {
        // This should never be called
    }
});
// Run task
taskRunner.run();
