import { posix } from 'path';
import { commands, window, workspace } from 'vscode';
import * as YAML from 'yaml';

import ConfigManager from '../config';
import { generateAccessToken } from '../services';
import {getEncryptionAndDecryptionKey} from '../utils/authentication'

export const add = async (local?: boolean) => {
  const editor = window.activeTextEditor;
  // const terminal = window.activeTerminal;
  // try {
  //           await ConfigManager.init();
  //       const { user } = await generateAccessToken(
  //   await ConfigManager.getToken(),
  // );
  // console.log({user});
  // } catch (error) {
  //   console.log(error)
  // }

  if (editor) {
    const document = editor.document;
    const selection = editor.selection;
    // Get the word within the selection
    const secret = document.getText(selection);
    if (!secret || secret === '') {
      return window.showErrorMessage('Please highlight a text');
    }

    const secretName = await window.showInputBox({
      title: 'What should the secret be named?',
      prompt: 'Name of the secret',
      ignoreFocusOut: true,
    });
    if (secretName) {
      // editor.edit((editBuilder) => {
      //   editBuilder.replace(selection, `process.env.${secretName}`);
      // });

      /*I am using this for both adding secrets to the local yaml or uploading to onboardbase*/
      if (local) {
        const isSetUpFilePresent = await checkSetupFile();
        if (!isSetUpFilePresent) {
          return window.showErrorMessage(`Please Setup Your Project`);
        }

        await ConfigManager.init();
        const ymlFiles = await workspace.findFiles(
          '.onboardbase.yaml',
          '**/node_modules/**',
        );
        const configData = await workspace.fs.readFile(ymlFiles[0]);
        let config = YAML.parse(Buffer.from(configData).toString('utf8'));

        if (config?.secrets?.local) {
          config.secrets.local = [
            ...config.secrets.local,
            { [secretName]: secret },
          ];
        } else {
          config = {
            ...config,
            secrets: { local: [{ [secretName]: secret }] },
          };
        }

        const updatedConfig = YAML.stringify(config);
        const folderUri = workspace.workspaceFolders[0].uri;
        const configFile = folderUri.with({
          path: posix.join(folderUri.path, '.onboardbase.yaml'),
        });

        await workspace.fs.writeFile(
          configFile,
          Buffer.from(updatedConfig, 'utf8'),
        );

        return window.showInformationMessage('Secret added successfully');
      } else {
        commands.executeCommand('onboardbase-extension.upload', {
          [secretName]: secret,
        });
      }
    }
  }
};

const checkSetupFile = async (): Promise<
  Thenable<string | undefined> | boolean
> => {
  if (!window.activeTextEditor) {
    return window.showInformationMessage('Please open a folder or workspace');
  }
  const ymlFiles = await workspace.findFiles(
    '.onboardbase.yaml',
    '**/node_modules/**',
  );

  return ymlFiles.length > 0;
};
