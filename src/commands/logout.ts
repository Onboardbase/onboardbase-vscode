import * as vscode from 'vscode';
import { decryptSecrets } from '../utils';
import ConfigManager from '../config';
import { revokeAuthToken } from '../services';
import { join } from 'path';
import { homedir } from 'os';
import * as YAML from 'yaml';
import { readFileSync } from 'fs';

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

const checkForProjectScope = (): boolean => {
  // const onboardbaseDirectory = join(homedir(), '.onboardbase');
  const configFile = join(join(homedir(), '.onboardbase'), '.onboardbase.yaml');
  const ymlConfig = YAML.parse(readFileSync(configFile, { encoding: 'utf8' }));
  const scopes = ymlConfig.scoped;
  const projectScope = scopes[process.cwd()] ?? scopes['/'];
  return projectScope ? true : false;
};
