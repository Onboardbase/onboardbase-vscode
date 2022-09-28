import { ProgressLocation, window } from 'vscode';

import ConfigManager from '../config';
import { fetchRawSecrets } from '../utils';
import { checkForProjectScope } from '../utils/authentication';

export const search = async () => {
  if (!checkForProjectScope()) {
    return window.showErrorMessage('Please login');
  }

  await ConfigManager.init();
  const config = ConfigManager.getProjectConfig();
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
          const { env } = await fetchRawSecrets(
            config.setup.project,
            config.setup.environment,
          );

          const secrets = env.map((e) => JSON.parse(e));
          const foundSecret = secrets.find(
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
