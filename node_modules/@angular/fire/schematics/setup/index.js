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
exports.setupFirebase = exports.generateFirebaseJson = exports.ngAddSetupProject = exports.setupProject = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const core_1 = require("@angular-devkit/core");
const schematics_1 = require("@angular-devkit/schematics");
const utility_1 = require("@schematics/angular/utility");
const common_1 = require("../common");
const firebaseTools_1 = require("../firebaseTools");
const utils_1 = require("../utils");
const prompts_1 = require("./prompts");
const setupProject = (tree, context, features, config) => {
    const { projectName } = (0, utils_1.getProject)(config, tree);
    (0, utils_1.addIgnoreFiles)(tree);
    if (features.includes(0)) {
        const { path: workspacePath, workspace } = (0, utils_1.getWorkspace)(tree);
        const { project, projectName } = (0, utils_1.getProject)(config, tree);
        (0, exports.setupFirebase)({
            workspace,
            workspacePath,
            options: {
                project: projectName,
                firebaseProject: config.firebaseProject,
                firebaseApp: config.firebaseApp,
                firebaseHostingSite: config.firebaseHostingSite,
                sdkConfig: config.sdkConfig,
                prerender: undefined,
                browserTarget: config.browserTarget,
                serverTarget: config.serverTarget,
                prerenderTarget: config.prerenderTarget,
                ssrRegion: config.ssrRegion,
            },
            tree,
            context,
            project
        });
    }
    const featuresToImport = features.filter(it => it !== 0);
    if (featuresToImport.length > 0) {
        return (0, schematics_1.chain)([
            (0, utility_1.addRootImport)(projectName, ({ code, external }) => {
                external('initializeApp', '@angular/fire/app');
                return code `${external('provideFirebaseApp', '@angular/fire/app')}(() => initializeApp(${JSON.stringify(config.sdkConfig)}))`;
            }),
            ...(0, utils_1.featureToRules)(features, projectName),
        ]);
    }
};
exports.setupProject = setupProject;
const ngAddSetupProject = (options) => (host, context) => __awaiter(void 0, void 0, void 0, function* () {
    let projectRoot = host._backend._root;
    if (process.platform.startsWith('win32')) {
        projectRoot = (0, core_1.asWindowsPath)((0, core_1.normalize)(projectRoot));
    }
    const features = yield (0, prompts_1.featuresPrompt)();
    if (features.length > 0) {
        const firebaseTools = yield (0, firebaseTools_1.getFirebaseTools)();
        if (!host.exists('/firebase.json')) {
            (0, fs_1.writeFileSync)((0, path_1.join)(projectRoot, 'firebase.json'), '{}');
        }
        const user = yield (0, prompts_1.userPrompt)({ projectRoot });
        yield firebaseTools.login.use(user.email, { projectRoot });
        const { project: ngProject, projectName: ngProjectName } = (0, utils_1.getProject)(options, host);
        const [defaultProjectName] = (0, utils_1.getFirebaseProjectNameFromHost)(host, ngProjectName);
        const firebaseProject = yield (0, prompts_1.projectPrompt)(defaultProjectName, { projectRoot, account: user.email });
        let hosting = {};
        let firebaseHostingSite;
        if (features.includes(0)) {
            const results = yield (0, prompts_1.projectTypePrompt)(ngProject, ngProjectName);
            hosting = Object.assign(Object.assign({}, hosting), results);
            firebaseHostingSite = yield (0, prompts_1.sitePrompt)(firebaseProject, { projectRoot });
        }
        let firebaseApp;
        let sdkConfig;
        if (features.find(it => it !== 0)) {
            const defaultAppId = firebaseHostingSite === null || firebaseHostingSite === void 0 ? void 0 : firebaseHostingSite.appId;
            firebaseApp = yield (0, prompts_1.appPrompt)(firebaseProject, defaultAppId, { projectRoot });
            const result = yield firebaseTools.apps.sdkconfig('web', firebaseApp.appId, { nonInteractive: true, projectRoot });
            sdkConfig = result.sdkConfig;
        }
        return (0, exports.setupProject)(host, context, features, Object.assign(Object.assign(Object.assign({}, options), hosting), { firebaseProject, firebaseApp, firebaseHostingSite, sdkConfig }));
    }
});
exports.ngAddSetupProject = ngAddSetupProject;
function generateFirebaseJson(tree, path, project, region) {
    const firebaseJson = tree.exists(path)
        ? (0, common_1.safeReadJSON)(path, tree)
        : {};
    const newConfig = {
        target: project,
        source: '.',
        frameworksBackend: {
            region
        }
    };
    if (firebaseJson.hosting === undefined) {
        firebaseJson.hosting = [newConfig];
    }
    else if (Array.isArray(firebaseJson.hosting)) {
        const existingConfigIndex = firebaseJson.hosting.findIndex(config => config.target === newConfig.target);
        if (existingConfigIndex > -1) {
            firebaseJson.hosting.splice(existingConfigIndex, 1, newConfig);
        }
        else {
            firebaseJson.hosting.push(newConfig);
        }
    }
    else {
        firebaseJson.hosting = [firebaseJson.hosting, newConfig];
    }
    (0, common_1.overwriteIfExists)(tree, path, (0, common_1.stringifyFormatted)(firebaseJson));
}
exports.generateFirebaseJson = generateFirebaseJson;
const setupFirebase = (config) => {
    const { tree, workspacePath, workspace, options } = config;
    const project = workspace.projects[options.project];
    if (!project.architect) {
        throw new schematics_1.SchematicsException(`Angular project "${options.project}" has a malformed angular.json`);
    }
    project.architect.deploy = {
        builder: '@angular/fire:deploy',
        options: Object.assign(Object.assign({ version: 2, browserTarget: options.browserTarget }, (options.serverTarget ? { serverTarget: options.serverTarget } : {})), (options.prerenderTarget ? { prerenderTarget: options.prerenderTarget } : {}))
    };
    tree.overwrite(workspacePath, JSON.stringify(workspace, null, 2));
    generateFirebaseJson(tree, 'firebase.json', options.project, options.ssrRegion);
    (0, common_1.generateFirebaseRc)(tree, '.firebaserc', options.firebaseProject.projectId, options.firebaseHostingSite, options.project);
    return tree;
};
exports.setupFirebase = setupFirebase;
