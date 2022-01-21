"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeTest = exports.createTemporaryFolders = exports.cleanTemporaryFolders = exports.getTempDir = exports.setInputs = void 0;
const fs = require("fs");
const path = require("path");
const MockHelper_1 = require("azure-pipelines-tasks-packaging-common/Tests/MockHelper");
exports.setInputs = (taskRunner, inputs) => {
    for (const key in inputs) {
        const value = inputs[key];
        if (value || typeof value === "boolean") { // We still want false to show up as input
            taskRunner.setInput(key, String(value));
        }
    }
};
const deleteFolderRecursive = (path) => {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file, index) {
            let curPath = path + '/' + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            }
            else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};
exports.getTempDir = () => {
    return path.join(__dirname, '_temp');
};
function cleanTemporaryFolders() {
    deleteFolderRecursive(exports.getTempDir());
}
exports.cleanTemporaryFolders = cleanTemporaryFolders;
function createTemporaryFolders() {
    let testTempDir = exports.getTempDir();
    let sqTempDir = path.join(testTempDir, '.sqAnalysis');
    if (!fs.existsSync(testTempDir)) {
        fs.mkdirSync(testTempDir);
    }
    if (!fs.existsSync(sqTempDir)) {
        fs.mkdirSync(sqTempDir);
    }
}
exports.createTemporaryFolders = createTemporaryFolders;
exports.initializeTest = (taskRunner) => {
    process.env["SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"] = "https://xplatalm.visualstudio.com/";
    const tempDirectory = exports.getTempDir();
    process.env["AGENT_TEMPDIRECTORY"] = tempDirectory;
    process.env['BUILD_SOURCESDIRECTORY'] = '/user/build';
    process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "/user/build";
    process.env['HOME'] = '/users/test'; //replace with mock of setVariable when task-lib has the support
    // Set up mocks for common packages
    MockHelper_1.registerLocationHelpersMock(taskRunner);
    // Prevent file writes
    taskRunner.registerMockExport("writefile", (file, data, options) => { });
    taskRunner.registerMockExport("cp", (source, dest, options, continueOnError) => { });
};
