import * as vscode from 'vscode';
import { installCli, loginToOnboardBase, setUp, logout } from './commands';

export function activate(context: vscode.ExtensionContext) {
  //install the onboardbase cli
  //we can either do this, or make it a requirement that the extension should already be installed
  installCli();

  context.subscriptions.push(
    vscode.commands.registerCommand('onboardbase-extension.login', async () => {
      await loginToOnboardBase();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('onboardbase-extension.setup', async () => {
      await setUp();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('onboardbase-extension.logout', async () => {
      await logout();
    }),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}
