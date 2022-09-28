import { ProgressLocation, window } from 'vscode';

import { checkForProjectScope } from '../utils/authentication';
import ConfigManager from '../config';
import { uploadSecretsToOnboardbase } from '../utils';

export const upload = async (env: { [key: string]: string | number }) => {
  if (!checkForProjectScope()) {
    return window.showErrorMessage('Please login');
  }

  await ConfigManager.init();
  const config = ConfigManager.getProjectConfig();

  window.withProgress(
    {
      title: 'Uploading secret to onboardbase...',
      location: ProgressLocation.Notification,
      cancellable: false,
    },
    async () => {
      try {
        await uploadSecretsToOnboardbase(
          config.setup.project,
          config.setup.environment,
          env,
        );
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
