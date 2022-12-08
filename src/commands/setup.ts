import * as vscode from 'vscode';
import jwtDecode from 'jwt-decode';

import { checkForProjectScope } from '../utils/authentication';
import ConfigManager from '../config';
import { fetchProjects, generateAccessToken } from '../services';
import { setUpProject } from './setUpHelper';

enum Roles {
  Owner = 'Owner',
  Admin = 'Admin',
  Member = 'Member',
  TeamLead = 'Team Lead',
  Employee = 'Employee',
  Tester = 'Tester',
  Maintainer = 'Maintainer',
}

export const setUp = async () => {
  if (!checkForProjectScope()) {
    return vscode.window.showErrorMessage('Please login');
  }

  const isSetUpFilePresent = await checkSetupFile();
  if (isSetUpFilePresent) {
    return vscode.window.showInformationMessage(`Setup file is present`);
  }

  try {
    await ConfigManager.init();
    const { accessToken } = await generateAccessToken(
      await ConfigManager.getToken(),
    );

    let projects = await fetchProjects(accessToken);
    projects = projects.filter(({ member }) => member);

    const {
      team,
      teamRole,
    }: { team: { name: string }; teamRole: { id: string; name: Roles } } =
      jwtDecode(accessToken);

    if (Array.isArray(projects) && projects.length === 0) {
      return vscode.window.showInformationMessage(
        `Sorry you don't have any project under the ${team.name} team, please signin to Onboardbase and create a project.`,
      );
    }

    const canUploadEnv = teamRole.name !== Roles.Employee;
    const modifiedProjects = projects.map((project) =>
      Object.assign(project, {
        environments: {
          list: project.environments.list.filter(({ member }) => member),
        },
      }),
    );

    const project = await vscode.window.showQuickPick(
      modifiedProjects.map((project) => project.title),
      {
        title:
          '(folders) Configure Onboardbase for one of the following projects',
        ignoreFocusOut: false,
      },
    );

    const environments = modifiedProjects
      .find(({ title }) => project === title)
      ?.environments.list.map(({ title }) => title);
    const pickedEnv = await vscode.window.showQuickPick(environments, {
      title: `Select an environment for (${project})`,
    });
    setUpProject({ project, pickedEnv, canUploadEnv });
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
    '.onboardbase.yaml',
    '**/node_modules/**',
  );

  return ymlFiles.length > 0;
};
