import { window } from 'vscode';

export const save = (env: { [key: string]: string | number }) => {
  Object.keys(env).map((secret) =>
    window.showInformationMessage(
      `adding secret: ${secret} with value: ${env[secret]} to onboardbase`,
    ),
  );
};
