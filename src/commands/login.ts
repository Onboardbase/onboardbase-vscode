import * as os from 'os';
import * as open from 'open';
import { StatusBarItem, window, workspace } from 'vscode';

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
  let statusBar: StatusBarItem;

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
      // const browserOption = await window.showQuickPick(['Yes', 'No'], {
      //   title: 'Open the authorization page in your browser?',
      // });

      // if (browserOption === 'Yes') {}
      await open(authUrl);
      window.showInformationMessage('Waiting for browser authentication');
    }

    let newConfig = {
      scope: '/',
      token: undefined,
    };

    if (allConfigs['/']?.token && allConfigs['/']?.token !== undefined) {
      const scopedConfig = ConfigManager.getScopedConfig();
      return window.showInformationMessage('You have logged in already');
      //TODO Handle overwriring the login
    }

    const pollingInterval = 4000; // 4secs
    const pollingTimeout = 300000; // 5mins
    let authTokenResponse = await getAuthToken(pollingCode);

    let isAuthenticated = false;
    if (authTokenResponse?.errors) {
      let intervalHandler: NodeJS.Timeout;
      intervalHandler = setInterval(async () => {
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
             window.showInformationMessage('Authentication successful.');
          }
        }
      }, pollingInterval);

      const intervalTimeout = setTimeout(() => {
        clearInterval(intervalHandler);
        clearTimeout(intervalTimeout);
        // statusBar.dispose();
        return window.showErrorMessage('Authentication Timeout exceeded...');
      }, pollingTimeout);
    }
  } catch (err) {
    return window.showErrorMessage(err.name);
  }
};
