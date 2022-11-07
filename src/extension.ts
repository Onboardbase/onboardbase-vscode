import {
  ExtensionContext,
  commands,
  languages,
  workspace,
  TextLine,
} from 'vscode';

import {
  loginToOnboardBase,
  setUp,
  logout,
  add,
  upload,
  search,
  init,
  teammate,
} from './commands';
import { addMergeRequest } from './commands/mergeRequest';
import { CodelensProvider } from './config/CodeLensProvider';
import { parseEnvContentToObject } from './utils';

export function activate(context: ExtensionContext) {
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

  context.subscriptions.push(
    commands.registerCommand('onboardbase-extension.add_local', async () => {
      await add(true);
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
      commands.executeCommand('onboardbase-extension.upload', env);
    },
  );

  commands.registerCommand(
    'onboardbase-extension.upload',
    async (args: { [key: string]: string | number }) => {
      await upload(args);
    },
  );

  commands.registerCommand('onboardbase-extension.search', async () => {
    await search();
  });

  commands.registerCommand('onboardbase-extension.merge_request', async () => {
    await addMergeRequest();
  });

  commands.registerCommand('onboardbase-extension.init', async () => {
    await init();
  });

  commands.registerCommand('onboardbase-extension.teammate', async () => {
    await teammate();
  });
}

// this method is called when your extension is deactivated
export function deactivate() {}
