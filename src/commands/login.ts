import { spawn } from 'child_process';
import * as vscode from 'vscode';

import { defaultSpwanArgs } from '../utils';
import {
  LOGIN_ALREADY_LOGGED_IN,
  LOGIN_OPEN_AUTH_PAGE,
  LOGIN_SUCCESSFUL,
} from '../utils/cliMessages';

export const loginToOnboardBase = async () => {
  const logInCli = spawn('onboardbase login', defaultSpwanArgs);
  //initiate login
  //2. automatically enter yes to open URL
  //3. check stdout stream for authentication successfull

  logInCli.on('error', (err) => {
    vscode.window.showErrorMessage(err.message);
  });

  logInCli.stdout?.on('data', (data) => {
    const message: string = data.toString();
    if (message.includes(LOGIN_ALREADY_LOGGED_IN)) {
      return vscode.window.showInformationMessage(LOGIN_ALREADY_LOGGED_IN);
      //TODO scope login and overwrite global login
    }
    if (message.includes(LOGIN_OPEN_AUTH_PAGE)) {
      logInCli.stdin?.write('0x0A');
      logInCli.stdin?.end();
    }
    if (message.includes(LOGIN_SUCCESSFUL)) {
      return vscode.window.showInformationMessage(LOGIN_SUCCESSFUL);
    }
  });

  logInCli.on('exit', (code) => {
    if (code !== 0) {
    }
  });
};
