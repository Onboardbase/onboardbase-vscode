import * as os from 'os';
import open from 'open';
import { window, workspace } from 'vscode';

import ConfigManager from '../config';
import { getMachineID } from '../utils';
import { generateAuthCode, getAuthToken } from '../services';

export const loginToOnboardBase = async () => {
  await ConfigManager.init('Login');

  const hostname = os.hostname();
  const hostARCH = os.arch();
  const fingerprint = await getMachineID();
  const hostOS = os.platform();
  const allConfigs = ConfigManager.getConfigs();

  try {
    const { pollingCode, authCode } = await generateAuthCode(
      fingerprint,
      hostOS,
      hostname,
      hostARCH,
    );

    const cwd = workspace.workspaceFolders[0].uri.path;
    const dashboardHost =
      allConfigs[cwd]?.['dashboard-host'] ??
      allConfigs['/']?.['dashboard-host'] ??
      'https://app.onboardbase.com';

    const authUrl = dashboardHost.concat(`/auth/cli?authCode=${authCode}`);

    if (!allConfigs['/'] || !allConfigs['/']?.token) {
      //TODO ask user if they want to open auth page in browser
      await open(authUrl);
      window.showInformationMessage('Waiting for browser authentication');
    }

    const newConfig = {
      scope: '/',
      token: undefined,
    };

    if (allConfigs['/']?.token && allConfigs['/']?.token !== undefined) {
      window.showInformationMessage('You have logged in already');
      //TODO Handle overwriring the login
    }

    const pollingInterval = 4000; // 4secs
    const pollingTimeout = 300000; // 5mins
    let authTokenResponse = await getAuthToken(pollingCode);

    let isAuthenticated = false;
    if (authTokenResponse?.errors) {
      const intervalHandler = setInterval(async () => {
        if (!isAuthenticated) {
          authTokenResponse = await getAuthToken(pollingCode);
          if (!authTokenResponse?.errors) {
            isAuthenticated = true;
            clearInterval(intervalHandler);
            const { token } = authTokenResponse?.data?.verifyAuthCode;
            newConfig.token = token;
            await ConfigManager.updateGlobalConfig(
              Object.assign(newConfig, {
                dashboardHost,
                apiHost: ConfigManager.getAuthApiHost(),
                requirePassword: false,
                password: '',
                requirePasswordForCurrentSession: false,
              }),
            );
            // statusBar.dispose();
            clearTimeout(intervalTimeout);
            return window.showInformationMessage('Authentication successful.');
          }
        }
      }, pollingInterval);

      const intervalTimeout = setTimeout(() => {
        clearInterval(intervalHandler);
        clearTimeout(intervalTimeout);
        // statusBar.dispose();
        window.showErrorMessage('Authentication Timeout exceeded');
      }, pollingTimeout);
    }
  } catch (err) {
    return window.showErrorMessage(err.name);
  }
};
