import { readFileSync } from 'fs';
import { window } from 'vscode';
import { homedir } from 'os';
import { join } from 'path';
import { workspace } from 'vscode';
import * as YAML from 'yaml';
import NodeRSA from 'node-rsa';
import { getEncryptionPassphrase } from '.';
import CryptoJS = require('crypto-js');
import { fetchProjects } from '../services';
import ConfigManager from '../config';
import jwtDecode from 'jwt-decode';

export const checkSetupFile = async (): Promise<
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

export const getEnvironmentId = async (
  env: string,
  accessToken: string,
): Promise<string> => {
  const envs = await fetchProjects(accessToken);
  let environmentId: string;
  envs.find((e) =>
    e.environments.list.find((el) => {
      if (el.title === env) {
        environmentId = el.id;
      }
    }),
  );
  return environmentId;
};

export const checkForProjectScope = (): boolean => {
  // const onboardbaseDirectory = join(homedir(), '.onboardbase');
  const configFile = join(join(homedir(), '.onboardbase'), '.onboardbase.yaml');
  const ymlConfig = YAML.parse(readFileSync(configFile, { encoding: 'utf8' }));
  const scopes = ymlConfig.scoped;
  const cwd = workspace.workspaceFolders[0].uri.path;
  const projectScope = scopes[cwd] ?? scopes['/'];
  return projectScope ? true : false;
};

export const generateRsaKeys = (): {
  publicKey: string;
  privateKey: string;
} => {
  const key = new NodeRSA({ b: 512 });
  const keys = key.generateKeyPair();
  const publicKey = keys.exportKey('public');
  const privateKey = keys.exportKey('private');
  return { publicKey, privateKey };
};

export const rsaDecryptSecret = (data: string, privateKey: string) => {
  try {
    const rsaPrivateKey = new NodeRSA(privateKey);
    return rsaPrivateKey.decrypt(data, 'utf8');
  } catch (e) {
    return '';
  }
};

export const decryptSecrets = async (
  secrets: string,
  passphrase?: string,
): Promise<string | undefined> => {
  const encryptionPassphrase = await getEncryptionPassphrase();
  try {
    const bytes = CryptoJS.AES.decrypt(
      secrets,
      passphrase || encryptionPassphrase,
    );
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error(error);
  }
};

export const getEncryptionAndDecryptionKey = (accessToken: string): string => {
  const decodedJWT: { secretKey: string } = jwtDecode(accessToken);
  const key = rsaDecryptSecret(
    decodedJWT.secretKey,
    ConfigManager.getRsaKeys().privateKey as string,
  );

  return key;
};

export const getFrontendEncryptionKey = (): string => {
  return 'e8%!w%yM!eAewzdsegg8%!walmart%yelpMUSIC!eggAPPLEeggwalmartzip_H@BQF3J^2Bjqum3d2.4L@y/FCK3=~pTf~?s(}r8H</4gFnXn@8`wL^gWTVP26tD';
};

export const aesDecryptSecret = (secret: string) => {
  const key = ConfigManager.getRsaKeys().privateKey as string;
  return decryptSecrets(secret, key);
};

export const rsaEncryptSecret = (data: string, publicKey: string): string => {
  try {
    const rsaPublicKey = new NodeRSA(publicKey);
    return rsaPublicKey.encrypt(data, 'base64');
  } catch (e) {
    return '';
  }
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

export const encryptWithAESAndRSA = async (
  rsaPublicKey: string,
  secrets: string,
) => {
  const aesEncryptionKey = getFrontendEncryptionKey();
  const encryptedAES = await encryptSecrets(secrets, aesEncryptionKey);
  const encryptedRSA = rsaEncryptSecret(encryptedAES, rsaPublicKey);
  return encryptedRSA;
};
