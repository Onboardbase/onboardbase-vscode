import {
  ExtensionContext,
  commands,
  languages,
  workspace,
  TextLine,
} from 'vscode';

import {
  installCli,
  loginToOnboardBase,
  setUp,
  logout,
  add,
  save,
} from './commands';
import { CodelensProvider } from './config/CodeLensProvider';
import { parseEnvContentToObject } from './utils';

export function activate(context: ExtensionContext) {
  //install the onboardbase cli
  //we can either do this, or make it a requirement that the extension should already be installed
  installCli();
  const codeLensProvider = new CodelensProvider();
  languages.registerCodeLensProvider({ pattern: '**/*.env' }, codeLensProvider);

  context.subscriptions.push(
    commands.registerCommand('onboardbase-extension.login', async () => {
      await loginToOnboardBase();
    }),
  );

  context.subscriptions.push(
    commands.registerCommand('onboardbase-extension.setup', async () => {
      await setUp();
    }),
  );

  context.subscriptions.push(
    commands.registerCommand('onboardbase-extension.logout', async () => {
      await logout();
    }),
  );

  context.subscriptions.push(
    commands.registerCommand('onboardbase-extension.add', async () => {
      await add();
    }),
  );

  commands.registerCommand('onboardbase-codelens.enableCodeLens', () => {
    workspace
      .getConfiguration('onboardbase-codelens')
      .update('enableCodeLens', true, true);
  });

  commands.registerCommand('onboardbase-codelens.disableCodeLens', () => {
    workspace
      .getConfiguration('onboardbase-codelens')
      .update('enableCodeLens', false, true);
  });

  commands.registerCommand(
    'onboardbase-codelens.codelensAction',
    (args: TextLine) => {
      const env = parseEnvContentToObject(args.text);
      commands.executeCommand('onboardbase-extension.save', env);
    },
  );

  commands.registerCommand(
    'onboardbase-extension.save',
    async (args: { [key: string]: string | number }) => {
      await save(args);
    },
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}
