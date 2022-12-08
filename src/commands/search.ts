import { ProgressLocation, window, workspace } from 'vscode';
import * as YAML from 'yaml';

import ConfigManager from '../config';
import { fetchRawSecrets } from '../utils';
import { checkForProjectScope } from '../utils/authentication';

export const search = async () => {
  if (!checkForProjectScope()) {
    return window.showErrorMessage('Please login');
  }

  await ConfigManager.init();
  const ymlFiles = await workspace.findFiles(
    '.onboardbase.yaml',
    '**/node_modules/**',
  );
  const configData = await workspace.fs.readFile(ymlFiles[0]);
  const config = YAML.parse(Buffer.from(configData).toString('utf8'));

  const secretName = await window.showInputBox({
    title: 'Search for a secret',
    placeHolder: 'Name of secret ',
  });

  if (secretName) {
    try {
      window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: 'Retrieving Secret...',
        },
        async () => {
          const { env } = await fetchRawSecrets({
            environment: config.setup.environment,
            projectName: config.setup.project,
          });

          const foundSecret = env.find(
            (secret) => secret.key.toLowerCase() === secretName.toLowerCase(),
          );
          if (foundSecret) {
            window.showInputBox({
              value: foundSecret.value,
              title: secretName,
              prompt: 'Here is the value for the secret you requested',
            });
          } else {
            window.showErrorMessage(`Secret: ${secretName} couldn't be found`);
          }

          return new Promise<void>((resolve) => resolve());
        },
      );
    } catch (error) {
      console.error(error);
      return window.showErrorMessage(error.name);
    }
  }
};
