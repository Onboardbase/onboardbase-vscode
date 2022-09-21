import * as vscode from 'vscode';
import ConfigManager from '../config';

export const revokeAuthToken = async (token: string) => {
  const instance = ConfigManager.getHttpInstance();
  try {
    const query = `mutation {
      revokeAuthToken(token: "${token}") {
        status
        message
      }
    }
    `;
    const { data } = await instance.post('', { query });
    return data?.data?.revokeAuthToken;
  } catch (error) {
    //console.log(chalk.bold.red("Could not revoke auth token"));
    vscode.window.showErrorMessage('Could not revoke auth token');
  }
};
