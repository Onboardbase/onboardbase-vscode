import { window } from 'vscode';
import * as os from 'os';

import ConfigManager from '../config';
import {
  createProject,
  fetchProjects,
  generateAccessToken,
  generateAuthCode,
  getAuthToken,
  signup,
} from '../services';
import { getMachineID } from '../utils';
import { setUpProject } from './setUpHelper';

export const init = async () => {
  await ConfigManager.init('Login');

  const email = await window.showInputBox({
    value: '',
    title: 'Email Address',
    prompt: 'Please Input Your Email Address',
  });
  if (!email) {
    window.showErrorMessage('Please add your email address');
    return;
  }

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

  const name = email.substring(0, email.lastIndexOf('@'));
  const domain = email.substring(email.lastIndexOf('@') + 1);
  if (!name || !domain) {
    window.showErrorMessage('Invalid Email Address');
    return new Promise<void>((resolve) => resolve());
  }
  const teamName = domain.split('.')[0];
  const orgName = `${name}_${teamName}`;

  try {
    await signup({ name, email, teamName: orgName, authCode });
    window.showInformationMessage(
      `Organizaiion: ${orgName} Created Successfully`,
    );
    window.showInformationMessage(
      'Account Created Successfully. Please check you email for verification',
    );

    const allConfigs = ConfigManager.getConfigs();
    let newConfig = {
      scope: '/',
      token: undefined,
    };

    window.showInformationMessage('Waiting for email verification...');

    const pollingInterval = 4000; // 4secs
    const pollingTimeout = 300000; // 5mins
    let authTokenResponse = await getAuthToken(pollingCode);
    let isAuthenticated = false;

    const dashboardHost =
      allConfigs[process.cwd()]?.['dashboard-host'] ??
      allConfigs['/']?.['dashboard-host'] ??
      'https://app.onboardbase.com';

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

            clearTimeout(intervalTimeout);
            window.showInformationMessage(
              'Verification Complete. You are now logged in',
            );

            const projectTitle = await window.showInputBox({
              value: '',
              title: 'Project Name',
              prompt: 'Please Enter A Project Name',
              ignoreFocusOut: false,
            });

            if (!projectTitle) {
              return new Promise<void>((resolve) => resolve());
            }

            window.showInformationMessage('Creating Project...');
            const { accessToken } = await generateAccessToken(
              await ConfigManager.getToken(),
            );
            await createProject(accessToken, projectTitle, '');
            window.showInformationMessage(
              `Project ${projectTitle} created successfully`,
            );

            const projects = await fetchProjects(accessToken);

            const environment = projects
              .find(({ title }) => projectTitle === title)
              ?.environments.list.map(({ title }) => title);
            window.showInformationMessage(
              `Environment with name ${environment[0]} created successfully`,
            );

            /*create project end*/

            /* Setup Project */
            window.showInformationMessage('Setting Up Your Project');
            await setUpProject(projectTitle, environment?.[0]);

            window.showInformationMessage(
              'Start your project with onboardbase run “start command”',
            );
            window.showInformationMessage(
              'Check out your account at: https://app.onboardbase.com',
            );
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
    window.showErrorMessage(err);
    return new Promise<void>((reject) => reject());
  }
};
