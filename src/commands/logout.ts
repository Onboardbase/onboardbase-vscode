import * as vscode from 'vscode';
import { decryptSecrets } from '../utils';
import ConfigManager from '../config';
import { revokeAuthToken } from '../services';
import { checkForProjectScope } from '../utils/authentication';

export const logout = async () => {
  if (!checkForProjectScope()) {
    return vscode.window.showErrorMessage('Please login');
  }

  await ConfigManager.init();
  const scopes = ConfigManager.getConfigs();

  const scopesInput: vscode.QuickPickItem[] = Object.keys(scopes).map(
    (key) => ({
      label: key,
    }),
  );
  const scopesSelection = vscode.window.createQuickPick();
  scopesSelection.items = scopesInput;
  scopesSelection.title = 'Revoke auth token scoped to';

  scopesSelection.onDidChangeSelection(async ([{ label }]) => {
    const project = label;
    scopesSelection.dispose();

    const shouldRevoke = await vscode.window.showQuickPick(['Yes', 'No'], {
      title: `Are you sure you want to revoke auth token scoped to (${project})`,
    });
    const projectToken = scopes[project].token;

    if (shouldRevoke === 'Yes') {
      await revokeAuthToken(
        projectToken.startsWith('Service')
          ? projectToken
          : ((await decryptSecrets(projectToken)) as string),
      );
      await ConfigManager.deleteToken({ scope: project });
      vscode.window.showInformationMessage('Auth token has been revoked');
    }

    if (shouldRevoke === 'No') {
      return vscode.window.showInformationMessage('Aborting');
    }
  });
  scopesSelection.show();
};
