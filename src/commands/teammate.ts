import { commands, window } from 'vscode';
import { getTeamMateByCode, teamMateSignup } from '../services';

export const teammate = async () => {
  const signupLink = await window.showInputBox({
    value: '',
    title: 'Link',
    prompt: 'Please Input The Link You Received in Your Email',
  });

  if (!signupLink) {
    window.showErrorMessage('Please add the link sent to you by your admin.');
    return;
  }

  if (!isValidURL(signupLink)) {
    window.showErrorMessage('Please enter a valid URL');
    return;
  }

  const joinUrl = new URL(signupLink);
  const pathUrl = joinUrl.pathname.split('/');
  const consfirmationCode = pathUrl[2];

  try {
    const name = await window.showInputBox({
      value: '',
      title: 'Name',
      prompt: 'Please Input Your Name',
    });

    window.showInformationMessage('Setting up Your Account...');
    const userId = await getTeamMateByCode(consfirmationCode);
    await teamMateSignup({ userId, name });
    window.showInformationMessage('Account Setup Completed');

    await commands.executeCommand('onboardbase-extension.login');
    await commands.executeCommand('onboardbase-extension.setup');

    window.showInformationMessage('Welcome to Onboardbase');
  } catch (error) {
    window.showErrorMessage(error.name);
    return;
  }
};

export const isValidURL = (url: string) => {
  let isValid = true;
  try {
    new URL(url);
  } catch (err) {
    isValid = false;
  }

  return isValid;
};
