import * as vscode from 'vscode';
import { installCli } from './commands/installCli';
import { loginToOnboardBase } from './commands/login';
import { setUp } from './commands/setup';

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
}

// this method is called when your extension is deactivated
export function deactivate() {}
