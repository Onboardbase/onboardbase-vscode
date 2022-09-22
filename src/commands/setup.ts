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

      let config = YAML.stringify({
        setup: {
          project,
          environment: pickedEnv,
        },
      });

      // //TODO Update the project config if there's one present
      const folderUri = vscode.workspace.workspaceFolders[0].uri;
      const configFile = folderUri.with({
        path: posix.join(folderUri.path, '.onboardbase.yaml'),
      });
      const baseFile = posix.parse(configFile.path).base;

      await vscode.workspace.fs.writeFile(
        configFile,
        Buffer.from(config, 'utf8'),
      );

      const gitIgnoreFile = folderUri.with({
        path: posix.join(folderUri.path, '.gitignore'),
      });
      if (await isFileExists(gitIgnoreFile)) {
        const saveToGitIgnore = await vscode.window.showQuickPick(
          ['Yes', 'No'],
          {
            title: `Would you like to add the config file to .gitignore`,
          },
        );

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
                  project,
                  pickedEnv,
                  parseEnvContentToObject(envContent),
                );

                return new Promise<Thenable<string>>((resolve) => {
                  resolve(
                    vscode.window.showInformationMessage(
                      'ENV Contents has been uploaded to Onboardbase successfully.',
                    ),
                  );
                });
              },
            );

            if (shouldDeleteEnvFileAfterSync === 'Yes') {
              vscode.workspace.fs.delete(envFiles[0]);
              vscode.window.showInformationMessage('ENV File has been deleted');
            }
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
            }
          }
        }
      }

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
    '.onboardbase',
    '**/node_modules/**',
  );
  return ymlFiles.length > 0;
};
