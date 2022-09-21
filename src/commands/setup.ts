import * as vscode from 'vscode';
import jwtDecode from 'jwt-decode';
import * as YAML from 'yaml';

import { checkForProjectScope } from '../utils/authentication';
import ConfigManager from '../config';
import { fetchProjects, generateAccessToken } from '../services';
import { writeFileSync } from 'fs';

export const setUp = async () => {
  if (!checkForProjectScope()) {
    return vscode.window.showErrorMessage('Please login');
  }

  const isSetUpFilePresent = await checkSetupFile();
  if (isSetUpFilePresent) {
    return vscode.window.showInformationMessage(`Setup file is present`);
  }

  await ConfigManager.init();
  try {
    const { accessToken } = await generateAccessToken(
      await ConfigManager.getToken(),
    );
    let projects = await fetchProjects(accessToken);
    projects = projects.filter(({ member }) => member);
    
    const { team }: { team: { name: string } } = jwtDecode(accessToken);
    if (Array.isArray(projects) && projects.length === 0) {
      return vscode.window.showInformationMessage(
        `Sorry you don't have any project under the ${team.name} team, please signin to Onboardbase and create a project.`,
      );
    }

    const modifiedProjects = projects.map((project) =>
      Object.assign(project, {
        environments: {
          list: project.environments.list.filter(({ member }) => member),
        },
      }),
    );

    const projectsInput: vscode.QuickPickItem[] = modifiedProjects.map(
      (project) => ({
        label: project.title,
        description:
          '$(folders) Configure onboardbase for ' + project.title.toUpperCase(),
      }),
    );
    const projectsInputSelection = vscode.window.createQuickPick();
    projectsInputSelection.items = projectsInput;
    projectsInputSelection.title = 'Select a project';

    projectsInputSelection.onDidChangeSelection(async ([{ label }]) => {
      const project = label;
      projectsInputSelection.dispose();

      const environments = modifiedProjects
        .find(({ title }) => project === title)
        ?.environments.list.map(({ title }) => title);
      const pickedEnv = await vscode.window.showQuickPick(environments, {
        title: `Select an environment for (${project})`,
      });

      const projectConfig = ConfigManager.getProjectConfig();
      const projectConfigFile = ConfigManager.projectConfigFile;
      console.log(projectConfigFile);
      let config = YAML.stringify({
        setup: {
          project,
          pickedEnv,
        },
      });
      //TODO Update the project config if there's one present
      writeFileSync(projectConfigFile, config);

      return vscode.window.showInformationMessage(
        'Setup complete. Run "onboardbase run" to start your app',
      );
    });
    
    projectsInputSelection.show();
  } catch (err) {
    return vscode.window.showErrorMessage(err.message);
  }
};

const checkSetupFile = async (): Promise<
  Thenable<string | undefined> | boolean
> => {
  if (!vscode.window.activeTextEditor) {
    return vscode.window.showInformationMessage(
      'Please open a folder or workspace',
    );
  }
  const ymlFiles = await vscode.workspace.findFiles(
    '.onboardbase.yml',
    '**/node_modules/**',
  );
  return ymlFiles.length > 0;
};
