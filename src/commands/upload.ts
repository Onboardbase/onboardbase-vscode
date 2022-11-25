import { ProgressLocation, window, workspace } from 'vscode';
import * as YAML from 'yaml';

import { checkForProjectScope } from '../utils/authentication';
import ConfigManager from '../config';
import { uploadSecretsToOnboardbase } from '../utils';

export const upload = async (env: { [key: string]: string }) => {
  if (!checkForProjectScope()) {
    return window.showErrorMessage('Please login');
  }

  const isSetUpFilePresent = await checkSetupFile();
  if (!isSetUpFilePresent) {
    return window.showErrorMessage(`Please setup your project`);
  }

  await ConfigManager.init();
  const ymlFiles = await workspace.findFiles(
    '.onboardbase.yaml',
    '**/node_modules/**',
  );
  const configData = await workspace.fs.readFile(ymlFiles[0]);
  const config = YAML.parse(Buffer.from(configData).toString('utf8'));

  window.withProgress(
    {
      title: 'Uploading secret to onboardbase...',
      location: ProgressLocation.Notification,
      cancellable: false,
    },
    async () => {
      try {
        await uploadSecretsToOnboardbase(config.setup.environment, env);
        window.showInformationMessage(
          'Secret has been uploaded to Onboardbase successfully.',
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

const checkSetupFile = async (): Promise<
  Thenable<string | undefined> | boolean
> => {
  if (!window.activeTextEditor) {
    return window.showInformationMessage('Please open a folder or workspace');
  }
  const ymlFiles = await workspace.findFiles(
    '.onboardbase.yaml',
    '**/node_modules/**',
  );

  return ymlFiles.length > 0;
};
