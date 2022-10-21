import { ProgressLocation, window, workspace } from 'vscode';
import * as YAML from 'yaml';

import ConfigManager from '../config/index';
import { createMergeRequest } from '../utils';
import { checkForProjectScope, checkSetupFile } from '../utils/authentication';

export const addMergeRequest = async () => {
  if (!checkForProjectScope()) {
    return window.showErrorMessage('Please login');
  }

  const isSetUpFilePresent = await checkSetupFile();
  if (!isSetUpFilePresent) {
    return window.showErrorMessage(`Please setup your project`);
  }
  await ConfigManager.init();
  const secretName = await window.showInputBox({
    title: 'What should the secret be named?',
    prompt: 'Name of the secret',
    ignoreFocusOut: true,
  });
  if (!secretName) {
    return window.showErrorMessage('Please give the secret a name');
  }

  const secret = await window.showInputBox({
    title: 'Please add the secret value',
    prompt: 'Secret Value',
    ignoreFocusOut: true,
  });
  if (!secret) {
    return window.showErrorMessage('Please input the secret');
  }

  const comment = await window.showInputBox({
    title: 'Add a comment',
    prompt: 'Notes on the merge request',
    ignoreFocusOut: true,
  });

  const ymlFiles = await workspace.findFiles(
    '.onboardbase.yaml',
    '**/node_modules/**',
  );
  const configData = await workspace.fs.readFile(ymlFiles[0]);
  let config = YAML.parse(Buffer.from(configData).toString('utf8'));

  window.withProgress(
    {
      title: 'Creating Merge Request...',
      location: ProgressLocation.Notification,
      cancellable: false,
    },

    async () => {
      try {
        await createMergeRequest(
          config.setup.environment,
          { key: secretName, value: secret },
          comment ? comment : '',
        );
        window.showInformationMessage(
          'Merge request created successfully. You will be notified on the status of your request',
        );
        return new Promise<void>((resolve) => {
          resolve();
        });
      } catch (error) {
        console.error(error);
        return window.showErrorMessage(error.message);
      }
    },
  );
};
