import { SpawnOptions } from 'child_process';
import * as vscode from 'vscode';
import { machineId } from 'node-machine-id';
import * as CryptoJS from 'crypto-js';
import { join } from 'path';
import { existsSync } from 'fs';
import isWsl = require('is-wsl');
import { v4 as uuidv4 } from "uuid";

import { isDocker } from './isDocker';
import { fetchSecrets, generateAccessToken, updateEnvironment } from '../services';
import ConfigManager from '../config';
import { aesDecryptSecret, encryptWithAESAndRSA, rsaDecryptSecret } from './authentication';

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
    // Silent this error and just delete the config files from the user's device
    // console.error(
    //   "Invalid passprase.. pls check your passphrase and try again"
    // );
    // process.exit(1);
  }
};

export const isFileExists = async (file: vscode.Uri): Promise<boolean> => {
  try {
    await vscode.workspace.fs.stat(file);
    return true;
  } catch (err) {
    return false;
  }
};

export const readFile = async (file: vscode.Uri): Promise<string> => {
  const readData = await vscode.workspace.fs.readFile(file);
  return Buffer.from(readData).toString('utf8');
};

export const parseEnvContentToObject = (envFileContent: string) => {
  const parsedJSON = {};

  let certKeys = [];
  let currentCertKey = { name: "", value: "", exists: false };
  const modifiedData = envFileContent.split("\n").map((keyAndValue: string) => {
    if (keyAndValue.includes("-----BEGIN")) {
      currentCertKey.exists = true;
      const nameBegin = keyAndValue.split("=");
      currentCertKey.name = nameBegin[0];
      currentCertKey.value = nameBegin[1];
      return "";
    } else if (keyAndValue.includes("-----END")) {
      certKeys.push({
        name: currentCertKey.name,
        value: `${currentCertKey.value}\n${keyAndValue}`,
      });
      currentCertKey = { name: "", value: "", exists: false };
      return "";
    } else if (currentCertKey.exists) {
      currentCertKey.value = `${currentCertKey.value}\n${keyAndValue}`;
      return "";
    }
    return keyAndValue;
  });

  const restructuredData = modifiedData
    .join("\n")
    .trim()
    .split(/\r?\n/)
    .filter((x) => x.trim() !== "");

  restructuredData.map((data) => {
    const keyAndValue = data.split("=");

    if (
      !keyAndValue[0].trim().startsWith("#") &&
      keyAndValue[1] !== undefined
    ) {
      parsedJSON[keyAndValue[0]] = keyAndValue[1];
    }
  });

  certKeys = certKeys.filter(
    (x) => x.value?.trim() !== "" && x.key?.trim() !== ""
  );

  certKeys.map((data) => {
    if (!data.name.trim().startsWith("#") && data.value !== undefined) {
      parsedJSON[data.name] = data.value;
    }
  });

  return parsedJSON;
};

export const fetchRawSecrets = async (
  project: string,
  environment: string
): Promise<{
  env: string[];
  user: { name: string; id: string };
  accessToken: string;
  environmentId: string;
}> => {
  const { accessToken, user } = await generateAccessToken(
    await ConfigManager.getToken()
  );

  let secrets = await fetchSecrets(project, environment, accessToken);
  secrets = secrets?.data?.generalProjects.list[0].environments.list;

  const userCanFetchSecretUnderEnvironment = secrets?.[0]?.member;
  if (!userCanFetchSecretUnderEnvironment) {
   throw new Error(`You don't have enough permission to update/upload/delete secrets under the ${
          environment
        } environment.`)
  }
  const environmentId = secrets[0]?.id;
  secrets = JSON.parse(secrets[0].key);

  const secretArray = [];

  if (secrets) {
    await Promise.all(
      secrets.map(async (secret: string) => {
        const decryptedRsaSecret = rsaDecryptSecret(
          secret,
          ConfigManager.getRsaKeys().privateKey as string
        );

        const aesSecret = await aesDecryptSecret(decryptedRsaSecret);

        secretArray.push(aesSecret);
      })
    );

    return {
      env: secretArray,
      user,
      accessToken,
      environmentId,
    };
  }
  return {
    env: ["{}"],
    user,
    accessToken,
    environmentId,
  };
};

export const formatDate = (date: string, sec?) => {
  let day = "",
    month = "",
    convMonth = "",
    year = "",
    time = "";

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "April",
    "May",
    "June",
    "July",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const getMonth = (val) => months[Number(val) - 1];

  let split;
  if (date) {
    split = date.split("-");
    day = `${split[2][0]}${split[2][1]}`;
    month = split[1];
    year = split[0];
    time = split[2].slice(3, sec ? 11 : 8);
    convMonth = getMonth(month);
    return `${convMonth} ${day}, ${year} | ${time} GMT`;
  }
};

export const removeDuplicateSecrete = (data: Object[]) => {
  const comparisonMap = {};
  const cleanArr = [];
  data.map((currentSecret: { [key: string]: string }) => {
    const { key = null, value = null } = comparisonMap[currentSecret.key] || {};
    if (!key || (key && value !== currentSecret.value)) {
      comparisonMap[currentSecret.key] = currentSecret;
    }
  });
  Object.keys(comparisonMap).map((key) => cleanArr.push(comparisonMap[key]));

  return cleanArr;
};

export const uploadSecretsToOnboardbase = async (
  currentProject: string,
  currentEnvironment: string,
  parsedJSON: Object,
  excludeFromExistingSecrets?: string[],
  action?: string
) => {
  const newSecrets = [];

  const { env, user, accessToken, environmentId } = await fetchRawSecrets(
    currentProject,
    currentEnvironment
  );

  const secretsToDelete = [];
  if (action === "DELETE") {
    excludeFromExistingSecrets.map((secretKey) => {
      secretsToDelete.push(
        JSON.parse(
          env.find(
            (secret) => JSON.parse(secret).key === secretKey.toUpperCase()
          )
        )
      );
    });
  }

  const backendRsaPublicKey = ConfigManager.getRsaKeys()
    .backendPublicKey as string;
  const existingSecrets = [];
  env.map((strigifiedEnv) => {
    const parsedSecret = JSON.parse(strigifiedEnv as unknown as string);
    if (excludeFromExistingSecrets && excludeFromExistingSecrets.length > 0) {
      if (!excludeFromExistingSecrets.includes(parsedSecret.key))
        existingSecrets.push(parsedSecret);
    } else {
      if (parsedSecret.key) {
        existingSecrets.push(parsedSecret);
      }
    }
  });

  await Promise.all([
    Object.keys(parsedJSON).map(async (key) => {
      const existingSecretData = existingSecrets.find(
        (secret) => secret.key === key.toUpperCase()
      );
      const secret = {
        id: existingSecretData?.id || uuidv4(),
        key: key.toUpperCase(),
        value: parsedJSON[key],
        comment: "",
        addedBy: {
          name: user.name,
          id: user.id,
        },
        addedDate: formatDate(new Date(Date.now()).toISOString()),
        method: "UPDATE",
      };
      newSecrets.push(secret);
    }),
  ]);

  /**
   * @todo
   * deprecate the `removeDuplicateSecrete` function
   */

  const joinedSecretsArray = [...newSecrets];
  if (action === "DELETE")
    joinedSecretsArray.push(
      ...secretsToDelete.map((secret) =>
        Object.assign(secret, { method: "DELETE" })
      )
    );
  const mergedSecrets = removeDuplicateSecrete(joinedSecretsArray);

  const finalSecrets = [];

  await Promise.all(
    mergedSecrets.map(async (mergedSecret) => {
      const stringifiedJson = JSON.stringify(mergedSecret);
      finalSecrets.push(
        JSON.stringify(
          await encryptWithAESAndRSA(backendRsaPublicKey, stringifiedJson)
        )
      );
    })
  );

  await updateEnvironment(accessToken, environmentId, finalSecrets);
};