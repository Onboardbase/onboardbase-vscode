import { posix } from 'path';
import * as vscode from 'vscode';
import jwtDecode from 'jwt-decode';
import * as YAML from 'yaml';

import { checkForProjectScope } from '../utils/authentication';
import {
  isFileExists,
  parseEnvContentToObject,
  readFile,
  uploadSecretsToOnboardbase,
} from '../utils';
import ConfigManager from '../config';
import { fetchProjects, generateAccessToken } from '../services';

export const setUp = async (data?: {
  project: string;
  environment: string;
}) => {
  if (!checkForProjectScope()) {
    return vscode.window.showErrorMessage('Please login');
  }

  const isSetUpFilePresent = await checkSetupFile();
  if (isSetUpFilePresent) {
    return vscode.window.showInformationMessage(`Setup file is present`);
  }

  try {
    await ConfigManager.init();
    let project = data.project, pickedEnv = data.environment;

    const { accessToken } = await generateAccessToken(
      await ConfigManager.getToken(),
    );

    if (!data && (!data.project || !data.environment)) {
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

      project = await vscode.window.showQuickPick(
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
      pickedEnv = await vscode.window.showQuickPick(environments, {
        title: `Select an environment for (${project})`,
      });
    }

    let config = YAML.stringify({
      setup: {
        project: project,
        environment: pickedEnv,
      },
    });

    const folderUri = vscode.workspace.workspaceFolders[0].uri;
    const configFile = folderUri.with({
      path: posix.join(folderUri.path, '.onboardbase.yaml'),
    });
    const baseFile = posix.parse(configFile.path).base;

    await vscode.workspace.fs.writeFile(
      configFile,
      Buffer.from(config, 'utf8'),
    );

    vscode.window.showInformationMessage(
      'Setup complete. Run "onboardbase run" to start your app',
    );

    const gitIgnoreFile = folderUri.with({
      path: posix.join(folderUri.path, '.gitignore'),
    });
    if (await isFileExists(gitIgnoreFile)) {
      const saveToGitIgnore = await vscode.window.showQuickPick(['Yes', 'No'], {
        title: `Would you like to add the config file to .gitignore`,
      });

      if (saveToGitIgnore === 'Yes') {
        const readData = await vscode.workspace.fs.readFile(gitIgnoreFile);
        let gitIgnoreFileContent = Buffer.from(readData).toString('utf8');

        if (!gitIgnoreFileContent.includes(baseFile)) {
          gitIgnoreFileContent += `\n${baseFile}`;
          await vscode.workspace.fs.writeFile(
            gitIgnoreFile,
            Buffer.from(gitIgnoreFileContent, 'utf8'),
          );
        }
      }
    }

    /**
     * Check if user has any .env file in their project directory
     * and ask if it should be synced to onboardbase and then deleted
     */
    const envFiles = await vscode.workspace.findFiles(
      '**/*.env',
      '**/node_modules/**',
    );
    if (envFiles.length > 0) {
      const shouldSyncEnv = await vscode.window.showQuickPick(['Yes', 'No'], {
        title: 'Would you like to upload the env contents to onboardbase',
      });

      if (shouldSyncEnv === 'Yes') {
        if (envFiles.length === 1) {
          const shouldDeleteEnvFileAfterSync =
            await vscode.window.showQuickPick(['Yes', 'No'], {
              title:
                'Would you like to delete the ENV file after uploading to onboardbase ?',
            });
          const envContent = await readFile(envFiles[0]);

          vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: 'Uploading ENV...',
              cancellable: false,
            },
            async () => {
              await uploadSecretsToOnboardbase(
                pickedEnv,
                parseEnvContentToObject(envContent),
              );

              if (shouldDeleteEnvFileAfterSync === 'Yes') {
                vscode.workspace.fs.delete(envFiles[0]);
                vscode.window.showInformationMessage(
                  'ENV File has been deleted',
                );
              }
              vscode.window.showInformationMessage(
                'ENV Contents has been uploaded to Onboardbase successfully.',
              );
              return new Promise<void>((resolve) => {
                resolve();
              });
            },
          );
        } else {
          const wouldLikeToSyncEnv = await vscode.window.showQuickPick(
            ['Yes', 'No'],
            {
              title: "Will you like to sync any of the ENV's to onboardbase",
            },
          );
          if (wouldLikeToSyncEnv === 'Yes') {
            const envSelection = await vscode.window.showQuickPick(
              envFiles.map((file) => posix.parse(file.path).base),
              { title: 'Please select the ENV file you would like to sync' },
            );

            const shouldDeleteEnvFileAfterSync =
              await vscode.window.showQuickPick(['Yes', 'No'], {
                title:
                  'Would you like to delete the ENV file after uploading to onboardbase ?',
              });
            const envContent = await readFile(
              envFiles.find(
                (file) => posix.parse(file.path).base === envSelection,
              ),
            );
            await uploadSecretsToOnboardbase(
              pickedEnv,
              parseEnvContentToObject(envContent),
            );
            if (shouldDeleteEnvFileAfterSync === 'Yes') {
              vscode.workspace.fs.delete(
                envFiles.find(
                  (file) => posix.parse(file.path).base === envSelection,
                ),
              );
              vscode.window.showInformationMessage('ENV File has been deleted');
            }
            vscode.window.showInformationMessage(
              'ENV Contents has been uploaded to Onboardbase successfully.',
            );
            return new Promise<void>((resolve) => {
              resolve();
            });
          }
        }
      }
    }

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
