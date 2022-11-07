import { window } from 'vscode';
import * as os from 'os';

import { getMachineID } from '../utils';
import {
  generateAuthCode,
  getAuthToken,
  getTeamMateByCode,
  teamMateSignup,
} from '../services';
import ConfigManager from '../config';

export const teammate = async () => {
  await ConfigManager.init('Login');

  const hostname = os.hostname();
  const hostARCH = os.arch();
  const fingerprint = await getMachineID();
  const hostOS = os.platform();

  const { pollingCode, authCode } = await generateAuthCode(
    fingerprint,
    hostOS,
    hostname,
    hostARCH,
  );

  const signupLink = await window.showInputBox({
    value: '',
    title: 'Link',
    prompt: 'Please Input The Link You Received in Your Email',
    ignoreFocusOut: true,
  });

  if (!signupLink) {
    window.showErrorMessage('Please add the link sent to you by your admin.');
    return;
  }

  if (!isValidURL(signupLink)) {
    window.showErrorMessage('Please enter a valid URL');
    return;
  }

  const joinUrl = new URL(signupLink);
  const pathUrl = joinUrl.pathname.split('/');
  const confirmationCode = pathUrl[2];

  window.showInformationMessage('Setting up Your Account...');

  try {
    const name = await window.showInputBox({
      value: '',
      title: 'Name',
      prompt: 'Please Input Your Name',
          ignoreFocusOut: true,
    });

    const userId = await getTeamMateByCode(confirmationCode);

    const allConfigs = ConfigManager.getConfigs();
    let newConfig = {
      scope: '/',
      token: undefined,
    };

    const pollingInterval = 4000; // 4secs
    const pollingTimeout = 300000; // 5mins
    let authTokenResponse = await getAuthToken(pollingCode);
    let isAuthenticated = false;

    const dashboardHost =
      allConfigs[process.cwd()]?.['dashboard-host'] ??
      allConfigs['/']?.['dashboard-host'] ??
      'https://app.onboardbase.com';

    await teamMateSignup({ userId, name, authCode, confirmationCode });

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
                password: undefined,
                requirePasswordForCurrentSession: false,
              }),
            );

            window.showInformationMessage('Account Setup Completed');
            window.showInformationMessage(
              'Verification Complete. You are now logged in',
            );

            window.showInformationMessage(
              'Start your project with onboardbase run “start command”',
            );
            window.showInformationMessage(
              'Check out your account at: https://app.onboardbase.com',
            );
            clearTimeout(intervalTimeout);
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
  } catch (error) {
    window.showErrorMessage(error.name);
    return;
  }
};

export const isValidURL = (url: string) => {
  let isValid = true;
  try {
    new URL(url);
  } catch (err) {
    isValid = false;
  }

  return isValid;
};
