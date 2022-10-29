import * as vscode from 'vscode';
import { exec, spawn } from 'child_process';
//TODO rewrite whole functionality
const installCli = () => {
  const defaultSpwanArgs = {
    shell: true,
    env: process.env,
  };

  const onboardbaseVersion = spawn(`onboardbase -v`, defaultSpwanArgs);

  onboardbaseVersion.stdout?.on('data', (data) => {
    if (!data.includes('@onboardbase/cli/')) {
      const installOnboardbase = exec(
        'npm i -g @onboardbase/cli@latest',
        (error, _, stderr) => {
          if (error) {
            vscode.window.showErrorMessage(error.message);
            return;
          }

          if (stderr) {
            return;
          }

          vscode.window.showInformationMessage(
            `Onboardbase CLI Installed Successfully`,
          );
          installOnboardbase.disconnect();
        },
      );
    } else {
      return;
    }
  });

  onboardbaseVersion.stderr?.on('data', (data) => {
    //TODO check if it is an update error, then update it
    vscode.window.showErrorMessage(data);
    vscode.commands.executeCommand('onboardbase-extension.helloWorld');
  });

  onboardbaseVersion.on('error', (err) =>
    vscode.window.showErrorMessage(err.message),
  );
};

export { installCli };
