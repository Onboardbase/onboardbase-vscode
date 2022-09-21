import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { defaultSpwanArgs } from './utils';
import { SETUP_NO_PROJECT, SETUP_SELECT_PROJECT } from './utils/cliMessages';

export const setUp = async () => {
  const isSetUpFilePresent = await checkSetupFile();
  if (isSetUpFilePresent) {
    return vscode.window.showInformationMessage(`Setup file is present`);
  }

  const setUpCli = spawn('onboardbase setup', defaultSpwanArgs);

  setUpCli.on('error', (err) => {
    vscode.window.showErrorMessage(err.message);
  });

  setUpCli.stdout.on('data', async (data) => {
    const message: string = data.toString();
    console.log(message);

    if (message.includes(SETUP_NO_PROJECT)) {
      return vscode.window.showInformationMessage(SETUP_NO_PROJECT);
    }

    if (message.includes(SETUP_SELECT_PROJECT)) {
      const projects = message.split('\n');
      projects.shift();
      //remove the > for every project
      //display a slection box for each project
      //get the index of the project and type in the down key number of indx times
             const projectsInput: vscode.QuickPickItem[] = projects.map((project) => ({
        label: project.substring(1).trim(),
        detail:
          '$(files) Setup secrets with project' + project.substring(1).trim(),
      }));

      const projectSelection = vscode.window.createQuickPick();
      projectSelection.items = projectsInput;
      projectSelection.title = 'Select Projects';

      projectSelection.onDidChangeSelection(([{ label }]) => {
        projectSelection.dispose();
        const selectionCount  = projectsInput.findIndex(item => item.label === label);
        // console.log(selectionCount, label);
        if(selectionCount > 0) {
                  const downArrowInput = '22 480'.repeat(selectionCount);
                  console.log(downArrowInput);
            setUpCli.stdin.write(downArrowInput);
            setUpCli.stdin.end();
        }

        // setUpCli.stdin.write('0x0A');
        // setUpCli.stdin.end();
      });

      projectSelection.show(); 
    }

  });

  //remove
  setUpCli.stdin.on('data', (data) => {
    console.log(data.toString());
  });

  setUpCli.stderr.on('data', (data) => {
    console.error(data);
  });
};

const checkSetupFile = async (): Promise<
  Thenable<string | undefined> | boolean
> => {
  if (!vscode.window.activeTextEditor) {
    return vscode.window.showInformationMessage(
      'Please open a folder or workspace',
    );
  }
  const ymlFiles = await vscode.workspace.findFiles(
    '.onboardbase.yml',
    '**/node_modules/**',
  );
  return ymlFiles.length > 0;
};
