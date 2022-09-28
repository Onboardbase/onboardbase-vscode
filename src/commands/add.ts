import { posix } from 'path';
import { commands, window, workspace } from 'vscode';
import * as YAML from 'yaml';

import ConfigManager from '../config';

export const add = async (local?: boolean) => {
  const editor = window.activeTextEditor;
  // const terminal = window.activeTerminal;
  if (editor) {
    const document = editor.document;
    const selection = editor.selection;

    // Get the word within the selection
    const secret = document.getText(selection);
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
        await ConfigManager.init();
        let config = ConfigManager.getProjectConfig();

        if (config?.secrets?.local) {
          config.secrets.local = Object.assign(config.secrets.local, {
            [secretName]: secret,
          });
        } else {
          config = Object.assign(config, {
            secret: { local: { [secretName]: secret } },
          });
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
