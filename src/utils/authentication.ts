import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import * as YAML from 'yaml';
import * as NodeRSA from "node-rsa";

export const checkForProjectScope = (): boolean => {
  // const onboardbaseDirectory = join(homedir(), '.onboardbase');
  const configFile = join(join(homedir(), '.onboardbase'), '.onboardbase.yaml');
  const ymlConfig = YAML.parse(readFileSync(configFile, { encoding: 'utf8' }));
  const scopes = ymlConfig.scoped;
  const projectScope = scopes[process.cwd()] ?? scopes['/'];
  return projectScope ? true : false;
};

export const generateRsaKeys = (): {
  publicKey: string;
  privateKey: string;
} => {
  const key = new NodeRSA({ b: 512 });
  const keys = key.generateKeyPair();
  const publicKey = keys.exportKey("public");
  const privateKey = keys.exportKey("private");
  return { publicKey, privateKey };
};