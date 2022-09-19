import * as vscode from 'vscode';
import { installCli } from './commands/installCli';
import { loginToOnboardBase } from './commands/login';

export function activate(context: vscode.ExtensionContext) {
  //install the onboardbase cli
  //we can either do this, or make it a requirement that the extension should already be installed
  installCli();

  let disposable = vscode.commands.registerCommand(
    'onboardbase-extension.login',
    async () => {
      await loginToOnboardBase();
    },
  );

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}


