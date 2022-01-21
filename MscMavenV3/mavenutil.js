"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishMavenInfo = exports.getExecOptions = exports.collectFeedRepositoriesFromEffectivePom = exports.collectFeedRepositories = exports.mergeCredentialsIntoSettingsXml = exports.writeJsonAsPomFile = void 0;
const Q = require("q");
const os = require("os");
const path = require("path");
const fs = require("fs");
const tl = require("azure-pipelines-task-lib/task");
const pkgLocationUtils = require("azure-pipelines-tasks-packaging-common/locationUtilities");
const util_1 = require("azure-pipelines-tasks-packaging-common/util");
const url = require("url");
const xml2js = require("xml2js");
const fse = require("fs-extra");
let stripbom = require('strip-bom');
let base64 = require('base-64');
let utf8 = require('utf8');
let uuidV4 = require("uuid/v4");
const accessTokenEnvSetting = 'ENV_MAVEN_ACCESS_TOKEN';
function readXmlFileAsJson(filePath) {
    return readFile(filePath, 'utf-8')
        .then(convertXmlStringToJson);
}
function readFile(filePath, encoding) {
    return Q.nfcall(fs.readFile, filePath, encoding);
}
function convertXmlStringToJson(xmlContent) {
    return __awaiter(this, void 0, void 0, function* () {
        return Q.nfcall(xml2js.parseString, stripbom(xmlContent));
    });
}
function writeJsonAsXmlFile(filePath, jsonContent, rootName) {
    let builder = new xml2js.Builder({
        pretty: true,
        headless: true,
        rootName: rootName
    });
    let xml = builder.buildObject(jsonContent);
    xml = xml.replace(/&#xD;/g, '');
    return writeFile(filePath, xml);
}
function writeJsonAsSettingsFile(filePath, jsonContent) {
    return writeJsonAsXmlFile(filePath, jsonContent.settings, 'settings');
}
function writeJsonAsPomFile(filePath, jsonContent) {
    return writeJsonAsXmlFile(filePath, jsonContent.project, 'project');
}
exports.writeJsonAsPomFile = writeJsonAsPomFile;
function writeFile(filePath, fileContent) {
    fse.mkdirpSync(path.dirname(filePath));
    return Q.nfcall(fs.writeFile, filePath, fileContent, { encoding: 'utf-8' });
}
function addPropToJson(obj, propName, value) {
    if (!obj) {
        obj = {};
    }
    if (obj instanceof Array) {
        let propNode = obj.find(o => o[propName]);
        if (propNode) {
            obj = propNode;
        }
    }
    let containsId = function (o) {
        if (value && value.id) {
            if (o.id instanceof Array) {
                return o.id.find((v) => {
                    return v === value.id;
                });
            }
            else {
                return value.id === o.id;
            }
        }
        return false;
    };
    if (propName in obj) {
        if (obj[propName] instanceof Array) {
            let existing = obj[propName].find(containsId);
            if (existing) {
                tl.warning(tl.loc('EntryAlreadyExists'));
                tl.debug('Entry: ' + value.id);
            }
            else {
                obj[propName].push(value);
            }
        }
        else if (typeof obj[propName] !== 'object') {
            obj[propName] = [obj[propName], value];
        }
        else {
            let prop = {};
            prop[propName] = value;
            obj[propName] = [obj[propName], value];
        }
    }
    else if (obj instanceof Array) {
        let existing = obj.find(containsId);
        if (existing) {
            tl.warning(tl.loc('EntryAlreadyExists'));
            tl.debug('Entry: ' + value.id);
        }
        else {
            let prop = {};
            prop[propName] = value;
            obj.push(prop);
        }
    }
    else {
        obj[propName] = value;
    }
}
function mavenSettingsJsonInsertServer(json, serverJson) {
    if (!json) {
        json = {};
    }
    if (!json.settings || typeof json.settings === "string") {
        json.settings = {};
    }
    if (!json.settings.$) {
        json.settings.$ = {};
        json.settings.$['xmlns'] = 'http://maven.apache.org/SETTINGS/1.0.0';
        json.settings.$['xmlns:xsi'] = 'http://www.w3.org/2001/XMLSchema-instance';
        json.settings.$['xsi:schemaLocation'] = 'http://maven.apache.org/SETTINGS/1.0.0' + os.EOL + 'https://maven.apache.org/xsd/settings-1.0.0.xsd';
    }
    if (!json.settings.servers) {
        json.settings.servers = {};
    }
    addPropToJson(json.settings.servers, 'server', serverJson);
}
function mergeCredentialsIntoSettingsXml(settingsXmlFile, repositories) {
    tl.debug('merging server credentials into settings.xml file=' + settingsXmlFile);
    if (repositories) {
        let insertServer = function (json) {
            for (let repository of repositories) {
                tl.debug('repository: ' + JSON.stringify(repository));
                let serverJson = {
                    id: repository.id,
                    configuration: {
                        httpHeaders: {
                            property: {
                                name: 'Authorization',
                                value: 'Basic ${env.' + accessTokenEnvSetting + '}'
                            }
                        }
                    }
                };
                tl.debug('inserting: ' + JSON.stringify(serverJson));
                mavenSettingsJsonInsertServer(json, serverJson);
            }
            tl.debug('complete json: ' + JSON.stringify(json));
            return writeJsonAsSettingsFile(settingsXmlFile, json);
        };
        return readXmlFileAsJson(settingsXmlFile).then(insertServer)
            .fail(function () {
            let json = {};
            return insertServer(json);
        });
    }
    else {
        tl.debug('no repositories...exitting');
        return Q.resolve(true);
    }
}
exports.mergeCredentialsIntoSettingsXml = mergeCredentialsIntoSettingsXml;
function getAuthenticationToken() {
    return base64.encode(utf8.encode('VSTS:' + pkgLocationUtils.getSystemAccessToken()));
}
function insertRepoJsonIntoPomJson(pomJson, repoJson) {
    if (!pomJson) {
        pomJson = {};
    }
    if (!pomJson.project || typeof pomJson.project === "string") {
        pomJson.project = {};
        pomJson.project.$['xmlns'] = 'http://maven.apache.org/POM/4.0.0';
        pomJson.project.$['xmlns:xsi'] = 'http://www.w3.org/2001/XMLSchema-instance';
        pomJson.project.$['xsi:schemaLocation'] = 'http://maven.apache.org/POM/1.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd';
    }
    if (!pomJson.project.repositories) {
        pomJson.project.repositories = {};
    }
    addPropToJson(pomJson.project.repositories, 'repository', repoJson);
}
function collectFeedRepositories(pomContents) {
    return __awaiter(this, void 0, void 0, function* () {
        return convertXmlStringToJson(pomContents).then(function (pomJson) {
            return __awaiter(this, void 0, void 0, function* () {
                let repos = [];
                if (!pomJson) {
                    tl.debug('Incomplete pom: ' + pomJson);
                    return Q.resolve(repos);
                }
                const collectionUrl = tl.getVariable("System.TeamFoundationCollectionUri");
                let packagingLocation;
                try {
                    packagingLocation = yield pkgLocationUtils.getPackagingUris(pkgLocationUtils.ProtocolType.Maven);
                }
                catch (error) {
                    tl.debug("Unable to get packaging URIs");
                    util_1.logError(error);
                    throw error;
                }
                let packageUrl = packagingLocation.DefaultPackagingUri;
                tl.debug('collectionUrl=' + collectionUrl);
                tl.debug('packageUrl=' + packageUrl);
                let collectionName = url.parse(collectionUrl).hostname.toLowerCase();
                let collectionPathName = url.parse(collectionUrl).pathname;
                if (collectionPathName && collectionPathName.length > 1) {
                    collectionName = collectionName + collectionPathName.toLowerCase();
                    tl.debug('collectionName=' + collectionName);
                }
                if (packageUrl) {
                    url.parse(packageUrl).hostname.toLowerCase();
                }
                else {
                    packageUrl = collectionName;
                }
                let parseRepos = function (project) {
                    if (project && project.repositories) {
                        for (let r of project.repositories) {
                            r = r instanceof Array ? r[0] : r;
                            if (r.repository) {
                                for (let repo of r.repository) {
                                    repo = repo instanceof Array ? repo[0] : repo;
                                    let url = repo.url instanceof Array ? repo.url[0] : repo.url;
                                    if (url && (url.toLowerCase().includes(collectionName) ||
                                        url.toLowerCase().includes(packageUrl) ||
                                        packagingLocation.PackagingUris.some(uri => url.toLowerCase().startsWith(uri.toLowerCase())))) {
                                        tl.debug('using credentials for url: ' + url);
                                        repos.push({
                                            id: (repo.id && repo.id instanceof Array)
                                                ? repo.id[0]
                                                : repo.id
                                        });
                                    }
                                }
                            }
                        }
                    }
                };
                if (pomJson.projects && pomJson.projects.project) {
                    for (let project of pomJson.projects.project) {
                        parseRepos(project);
                    }
                }
                else if (pomJson.project) {
                    parseRepos(pomJson.project);
                }
                else {
                    tl.warning(tl.loc('EffectivePomInvalid'));
                }
                tl.debug('Feeds found: ' + JSON.stringify(repos));
                return Promise.resolve(repos);
            });
        });
    });
}
exports.collectFeedRepositories = collectFeedRepositories;
function collectFeedRepositoriesFromEffectivePom(mavenOutput) {
    tl.debug('collecting account feeds from effective pom');
    const effectivePomStartTag = '<!-- Effective POM';
    const projectsBeginTag = '<projects';
    const projectsEndTag = '</projects>';
    const projectBeginTag = '<project';
    const projectEndTag = '</project>';
    let xml = String(mavenOutput);
    let effectivePomStart = xml.lastIndexOf(effectivePomStartTag);
    if (effectivePomStart === -1) {
        tl.warning(tl.loc('EffectivePomInvalid'));
        return Promise.resolve(true);
    }
    let xmlStart = xml.indexOf(projectsBeginTag, effectivePomStart);
    let xmlEnd = xml.indexOf(projectsEndTag, effectivePomStart);
    if (xmlStart !== -1 && xmlEnd !== -1 && (xmlStart < xmlEnd)) {
        xml = xml.substring(xmlStart, xmlEnd + projectsEndTag.length);
        return collectFeedRepositories(xml);
    }
    xmlStart = xml.indexOf(projectBeginTag, effectivePomStart);
    xmlEnd = xml.indexOf(projectEndTag, effectivePomStart);
    if (xmlStart !== -1 && xmlEnd !== -1 && (xmlStart < xmlEnd)) {
        xml = xml.substring(xmlStart, xmlEnd + projectEndTag.length);
        return collectFeedRepositories(xml);
    }
    tl.warning(tl.loc('EffectivePomInvalid'));
    return Promise.resolve(true);
}
exports.collectFeedRepositoriesFromEffectivePom = collectFeedRepositoriesFromEffectivePom;
function getExecOptions() {
    var env = process.env;
    env[accessTokenEnvSetting] = getAuthenticationToken();
    return {
        env: env,
    };
}
exports.getExecOptions = getExecOptions;
function publishMavenInfo(mavenInfo) {
    const stagingDir = path.join(tl.getVariable('Agent.TempDirectory'), '.mavenInfo');
    const randomString = uuidV4();
    const infoFilePath = path.join(stagingDir, 'MavenInfo-' + randomString + '.md');
    if (!tl.exist(stagingDir)) {
        tl.mkdirP(stagingDir);
    }
    tl.writeFile(infoFilePath, mavenInfo);
    tl.debug('[Maven] Uploading build maven info from ' + infoFilePath);
    tl.command('task.addattachment', {
        'type': 'Distributedtask.Core.Summary',
        'name': 'Maven'
    }, infoFilePath);
}
exports.publishMavenInfo = publishMavenInfo;
