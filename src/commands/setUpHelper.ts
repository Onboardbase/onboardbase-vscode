import { posix } from 'path';
import * as vscode from 'vscode';
import * as YAML from 'yaml';

import {
  isFileExists,
  parseEnvContentToObject,
  readFile,
  uploadSecretsToOnboardbase,
} from '../utils';

export const setUpProject = async (
  project: string,
  pickedEnv: string,
  authToken?: string,
) => {
  const config = YAML.stringify({
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

  await vscode.workspace.fs.writeFile(configFile, Buffer.from(config, 'utf8'));

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
        const shouldDeleteEnvFileAfterSync = await vscode.window.showQuickPick(
          ['Yes', 'No'],
          {
            title:
              'Would you like to delete the ENV file after uploading to onboardbase ?',
          },
        );
        const envContent = await readFile(envFiles[0]);

        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Uploading ENV...',
            cancellable: false,
          },
          async () => {
            await uploadSecretsToOnboardbase({
              currentEnvironment: pickedEnv,
              parsedJSON: parseEnvContentToObject(envContent),
              authToken,
            });

            if (shouldDeleteEnvFileAfterSync === 'Yes') {
              vscode.workspace.fs.delete(envFiles[0]);
              vscode.window.showInformationMessage('ENV File has been deleted');
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
          await uploadSecretsToOnboardbase({
            currentEnvironment: pickedEnv,
            parsedJSON: parseEnvContentToObject(envContent),
            authToken,
          });
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
};
