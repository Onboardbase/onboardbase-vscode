import { SpawnOptions } from 'child_process';
import { machineId } from 'node-machine-id';
import * as CryptoJS from 'crypto-js';
import { join } from 'path';
import { existsSync } from 'fs';
import { isDocker } from './isDocker';
import isWsl = require('is-wsl');

export const defaultSpwanArgs: SpawnOptions = {
  shell: true,
  cwd: process.cwd(),
  env: process.env,
  stdio: ['pipe', 'pipe', 'pipe'],
};

export const encryptSecrets = async (
  secrets: string,
  passphrase?: string,
): Promise<string> => {
  const encryptionPassphrase = await getEncryptionPassphrase();
  const bytes = CryptoJS.AES.encrypt(
    secrets,
    passphrase || encryptionPassphrase,
  );
  return bytes.toString();
};

export const getShellRc = (): string => {
  const shell = process.env.SHELL;
  const split = shell?.split('/');
  const fileName = `.${split?.[split.length - 1]}rc`;
  return join(String(process.env.HOME), fileName);
};

export const isExist = (filePath: string): boolean => {
  return existsSync(filePath);
};

export const isUnix = (): boolean => {
  return (
    ['darwin', 'linux'].includes(process.platform) && !isWsl && !isDocker()
  );
};

export const getEncryptionPassphrase = async (): Promise<string> => {
  // Use the user's machine ID as the encryption passphrase meaning only the user's device can decrypt the secret;
  const ENCRYTION_PASSPHRASE = await getMachineID();
  return ENCRYTION_PASSPHRASE;
};

export const getMachineID = async (): Promise<string> => {
  return await machineId();
};

export const decryptSecrets = async (
  secrets: string,
  passphrase?: string
): Promise<string | undefined> => {
  const encryptionPassphrase = await getEncryptionPassphrase();
  try {
    const bytes = CryptoJS.AES.decrypt(
      secrets,
      passphrase || encryptionPassphrase
    );
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    // Silent this error and just delete the config files from the user's device
    // console.error(
    //   "Invalid passprase.. pls check your passphrase and try again"
    // );
    // process.exit(1);
  }
};