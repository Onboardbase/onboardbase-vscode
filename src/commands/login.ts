import * as vscode from 'vscode';
import { spawn } from 'child_process';

export const loginToOnboardBase = async () => {
  //check if there's an onboardbase.yml file in the root dir
  const isLoggedIn = await isOnboardbaseYMLPresent();
  if (isLoggedIn) {
    return vscode.window.showInformationMessage('You are logged in');
  }

  const defaultSpwanArgs = {
    shell: true,
    env: process.env,
  };

  const logInCli = spawn('onboardbase login', defaultSpwanArgs);
  //initiate login
  //2. automatically enter yes to open URL
  //3. check stdout stream for authentication successfull

  logInCli.on('error', (err) => {
    vscode.window.showErrorMessage(err.message);
  });

  logInCli.stdout.on('data', (data) => {
    const message: string = data.toString();
    if (message.includes('You have already logged in.')) {
      return vscode.window.showInformationMessage(
        'You have already logged in.',
      );
      //TODO scope login and overwrite global login
    }
    if (message.includes('Open the authorization page in your browser?')) {
      logInCli.stdin.write('0x0A');
      logInCli.stdin.end();
    }
    if (message.includes('Authentication successful')) {
      return vscode.window.showInformationMessage('Login Successful');
    }
  });

  logInCli.on('exit', (code) => {
    if (code !== 0) {
    }
  });
};

const isOnboardbaseYMLPresent = async (): Promise<
  Thenable<string | undefined> | boolean
> => {
  if (!vscode.window.activeTextEditor) {
    return vscode.window.showInformationMessage(
      'Please open a folder or workspace',
    );
  }
  const ymlFiles = await vscode.workspace.findFiles(
    '.onboardbase.yml',
    '**/node_modules/**',
  );
  return ymlFiles.length > 0;
};
