import { commands, window } from 'vscode';

export const add = async () => {
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
      commands.executeCommand('onboardbase-extension.upload', {
        [secretName]: secret,
      });
    }
  }
};
