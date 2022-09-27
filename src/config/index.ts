import { ChildProcess } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import * as YAML from 'yaml';
import { encryptSecrets, getShellRc, isExist, isUnix } from '../utils';
import * as chalk from 'chalk';
import * as rimraf from 'rimraf';
import axios from 'axios';
import * as vscode from 'vscode';

class ConfigManager {
  private store: { [key: string]: string } = {};
  private runningProcess: {
    socket: ChildProcess | undefined;
    main: ChildProcess | undefined;
  } = {
    socket: undefined,
    main: undefined,
  };
  private configFile = '.onboardbase.yaml';
  public onboardbaseDirectory = join(homedir(), '.onboardbase');
  private onboardbaseFallbackDirectory = join(
    this.onboardbaseDirectory,
    'fallback',
  );
  public onboardbaseConfigFile = join(
    this.onboardbaseDirectory,
    this.configFile,
  );
  public onboardbaseDatabaseDirectory = join(
    this.onboardbaseDirectory,
    'db',
    'onboardbase.json',
  );
  private rsaKeys: {
    publicKey: string | undefined;
    privateKey: string | undefined;
    backendPublicKey: string | undefined;
  } = {
    publicKey: undefined,
    privateKey: undefined,
    backendPublicKey: undefined,
  };
  private authApiHost: string = '';
  private cwd = (vscode.workspace.workspaceFolders[0].uri).path;
  // private authSessionDetails: {
  //   email: string;
  //   team: { id: string; name: string };
  //   teamRole: { id: string; name: string };
  //   project: { id: string };
  // };
  public shouldCreateProjectLog: boolean = true;
  private projectFallbackConfigFile = join(this.cwd, 'onboardbase.yaml');
  private projectNewConfigFile = join(this.cwd, '.onboardbase.yaml');
  /**
   * check for .yml extension first before falling back to .yaml.
   */
  private projectConfigPath = join(this.cwd, '.onboardbase.yml');
  /**
   * Add a fallback for .yml extension incase a user chooses to use that in replace of .yaml
   *
   * Also check to see if the user has the old config file, that is `onboardbase.yaml`,
   * if user does, just fallback to that instead of assuming the user doesn't have any
   * local onboardbase config file.
   *
   * @todo
   *
   * Fallback should no longer be supported in the next couple of releases so as to enforce
   * using the new `.onboardbase.yaml` file instead.
   */
  public projectConfigFile = existsSync(this.projectConfigPath)
    ? this.projectConfigPath
    : existsSync(this.projectFallbackConfigFile)
    ? this.projectFallbackConfigFile
    : this.projectNewConfigFile;

  private syncSocketClient: any;

  /**
   *
   * @param apiHost string
   * This should only be called when authenticating.
   * How does it work? let's assume a user has two organizations, they have authenticated for one already and are trying
   * to authenticate for another organization, we need to map the 1st organization api-host to the scope of the organization
   * they're trying to auth with (that is, the 2nd organization).
   * Why? Because deviceTokens are scoped to api's. So the api that handled the authentication for the 2nd org
   * is also the api that has the organization's deviceToken.
   *
   * I hope you get it.
   */
  setAuthApiHost(apiHost: string) {
    this.authApiHost = apiHost;
  }

  getAuthApiHost(): string {
    return this.authApiHost;
  }

  setSyncSocketClient(socketClient: any): void {
    this.syncSocketClient = socketClient;
  }

  getSynSocketClient() {
    return this.syncSocketClient;
  }

  /**
   *
   * @param payload
   *
   * this is basically a decoded information of the user's authToken
   * & the ID of the current project the user is running for the current
   * CLI & Login Session
   */
  // set

  // getAuthSessionDetails(): {
  //   email: string;
  //   team: { id: string; name: string };
  //   teamRole: { id: string; name: string };
  //   project: { id: string };
  // } {
  //   return this.authSessionDetails;
  // }

  throwAuthenticationError() {
    vscode.window.showErrorMessage(
      'Please you need to login to start using the CLI.',
    );
  }

  checkAndCreateOnboardbaseDirectories() {
    // Create global onboardbase directory if it doesnt exist
    if (!isExist(this.onboardbaseDirectory))
      mkdirSync(this.onboardbaseDirectory);

    // Create fallback folder if it doesnt exist
    if (!isExist(this.onboardbaseFallbackDirectory))
      mkdirSync(this.onboardbaseFallbackDirectory);

    // Create db folder if it doesnt exist
    if (!isExist(join(this.onboardbaseDirectory, 'db'))) {
      mkdirSync(join(this.onboardbaseDirectory, 'db'));
    }
  }

  // Creates the .onboardbase.yaml file
  createOnboardbaseConfigFile(): void {
    writeFileSync(
      this.onboardbaseConfigFile,
      YAML.stringify({ scoped: {}, 'version-check': {} }),
    );
  }

  /**
   *
   * @param command string optional. It's used to exclude the
   * login command from throwing authentication error when ConfigManager
   * is called without being authenticated.
   * @returns void
   */
  async init(command?: string): Promise<void> {
    const isExist = (path: string) => existsSync(path);
    this.checkAndCreateOnboardbaseDirectories();

    if (!isExist(this.onboardbaseConfigFile)) {
      // check to see if the user is using ENV vars
      const onboardbaseToken = process.env.ONBOARDBASE_TOKEN;
      const onboardbaseProject = process.env.ONBOARDBASE_PROJECT;
      const onboardbaseEnvironment = process.env.ONBOARDBASE_ENVIRONMENT;

      if (onboardbaseToken !== undefined) {
        this.store = {
          project: onboardbaseProject as string,
          environment: onboardbaseEnvironment as string,
          token: onboardbaseToken,
        };

        return;
      }

      this.createOnboardbaseConfigFile();
      return;
    }

    const config = YAML.parse(
      readFileSync(this.onboardbaseConfigFile, { encoding: 'utf8' }),
    );
    const currentDirectory = this.cwd;
    const directoryScopes = config.scoped;
    const projectScope =
      directoryScopes[currentDirectory] ?? directoryScopes['/'];
    if (!projectScope && command !== 'Login') this.throwAuthenticationError();
    let finalConfig = projectScope;
    const projectScopedConfigPath = this.projectConfigFile;
    if (isExist(projectScopedConfigPath)) {
      const projectConfig = this.getProjectConfig();
      finalConfig = Object.assign(finalConfig ?? {}, projectConfig?.setup);
    }
    this.store = Object.assign(this.store, finalConfig);
  }

  registerProcess(identifier: 'socket' | 'main', process: ChildProcess) {
    this.runningProcess[identifier] = process;
  }

  closeRunningProcess() {
    try {
      this.runningProcess.main?.kill('SIGINT');
      this.runningProcess.socket?.kill('SIGINT');
      // process.nextTick(process.exit(1));

      // process.kill(this.runningProcess.main.pid, "SIGKILL");
      // process.kill(this.runningProcess.socket.pid, "SIGKILL");
      setTimeout(function () {
        process.exit(1);
      }, 3000);
    } catch (error) {}
  }

  getConfigs(): any {
    let directoryScopes;
    if (existsSync(this.onboardbaseConfigFile)) {
      const config = YAML.parse(
        readFileSync(this.onboardbaseConfigFile, { encoding: 'utf8' }),
      );
      directoryScopes = config.scoped;
    } else directoryScopes = {};
    return directoryScopes;
  }

  getScopedConfig(directory?: string): any {
    const directoryScopes = this.getConfigs();
    return directoryScopes[directory ?? this.cwd];
  }

  getProjectConfig(): any {
    const localConfig = this.projectConfigFile;
    if (isExist(localConfig)) {
      return YAML.parse(readFileSync(localConfig, { encoding: 'utf8' }));
    }
  }

  getLocalConfig() {
    return this.store;
  }

  /**
   * This returns an encrypted version of the user's token
   * @returns
   */
  getRawToken(): string {
    return this.store['token'];
  }

  /**
   * This returns a decrypted version of the user's token
   * @returns
   */
  async getToken(): Promise<string> {
    const token = this.store['token'];
    return token;
  }

  async isNewServiceToken(): Promise<boolean> {
    return (await this.getToken()).length < 43 ? true : false;
  }

  getRsaKeys(): {
    publicKey: string | undefined;
    privateKey: string | undefined;
    backendPublicKey: string | undefined;
  } {
    return this.rsaKeys;
  }

  storeRsaKeys(publicKey: string, privateKey: string) {
    this.rsaKeys.privateKey = privateKey;
    this.rsaKeys.publicKey = publicKey;
  }

  storeBackendPublicKey(publicKey: string) {
    this.rsaKeys.backendPublicKey = publicKey; // TODO: check if it is epheremal and needs to persist
  }

  async deleteToken({ scope }: { scope: string }) {
    const config = YAML.parse(
      readFileSync(this.onboardbaseConfigFile, { encoding: 'utf8' }),
    );

    let data: { scoped: { [key: string]: string } } = {
      scoped: {},
    };

    Object.keys(config.scoped).map((scopeConfig) => {
      if (scopeConfig !== scope) {
        data.scoped[scopeConfig] = config.scoped[scopeConfig];
      }
    });

    const newScope = YAML.stringify(data);
    writeFileSync(this.onboardbaseConfigFile, newScope);
  }

  getDirectoriesThatRequiresPassword() {
    const config = YAML.parse(
      readFileSync(this.onboardbaseConfigFile, { encoding: 'utf8' }),
    );

    const scoped = config.scoped;
    const directoriesThatNeedsPassword: string[] = [];

    Object.keys(scoped).map((scopedDirectoryKey) => {
      if (scoped[scopedDirectoryKey].requirePassword)
        directoriesThatNeedsPassword.push(scopedDirectoryKey);
    });

    return directoriesThatNeedsPassword;
  }

  async updateDirectorySessionConfig({
    scope,
    requirePasswordForCurrentSession,
  }: {
    scope: string;
    requirePasswordForCurrentSession: boolean;
  }) {
    const config = YAML.parse(
      readFileSync(this.onboardbaseConfigFile, { encoding: 'utf8' }),
    );

    const scoped = config.scoped;

    const updatedConfig = {
      scoped: {
        ...scoped,
        [scope]: {
          ...scoped[scope],
          requirePasswordForCurrentSession,
        },
      },
    };
    const newScope = YAML.stringify(updatedConfig);
    writeFileSync(this.onboardbaseConfigFile, newScope);
  }

  async updateGlobalConfig({
    scope = '/',
    token,
    apiHost,
    dashboardHost,
    requirePassword,
    password,
    requirePasswordForCurrentSession,
  }: {
    scope?: string;
    token?: string | undefined;
    authToken?: string | undefined;
    encryptToken?: boolean;
    apiHost?: string;
    dashboardHost?: string;
    requirePassword?: boolean;
    password?: string;
    requirePasswordForCurrentSession?: boolean;
  }) {
    this.checkAndCreateOnboardbaseDirectories();
    if (!isExist(this.onboardbaseConfigFile))
      this.createOnboardbaseConfigFile();

    const config = YAML.parse(
      readFileSync(this.onboardbaseConfigFile, { encoding: 'utf8' }),
    );

    interface TFinalData {
      'is-service-installed'?: boolean;
      scoped: {
        [key: string]: {
          token: string;
          'api-host': string;
          'dashboard-host': string;
          requirePassword?: boolean;
          password?: string;
          requirePasswordForCurrentSession?: boolean;
        };
      };
    }

    let finalData: TFinalData;

    if (config.scoped) {
      finalData = Object.assign(config, {
        scoped: Object.assign(config.scoped, {
          [scope]: {
            ...(config.scoped[scope] || {}),
            token,
            'api-host': apiHost ?? 'https://api.onboardbase.com/graphql',
            'dashboard-host': dashboardHost ?? 'https://app.onboardbase.com',
            requirePassword,
            password: await encryptSecrets(String(password)),
            requirePasswordForCurrentSession,
          },
        }),
      });
    } else {
      const lData: TFinalData = {
        scoped: {
          [scope]: {
            token,
            'api-host': apiHost ?? 'https://api.onboardbase.com/graphql',
            'dashboard-host': dashboardHost ?? 'https://app.onboardbase.com',
            requirePassword,
            password: await encryptSecrets(String(password)),
            requirePasswordForCurrentSession,
          },
        },
      };
      finalData = lData;
    }

    /**
     * Session Mananegment for secure build is only available for unix
     * right now. Windows users will always have to re-enter their password
     * eveyrtime they want to use the run/build command
     */
    if (requirePassword && isUnix()) {
      /**
       * check to see if onboardbase exist in the user's RC file
       */
      const shellRC = getShellRc();
      const existingData = readFileSync(shellRC, 'utf-8');
      const existDataArray = existingData.split('\n');

      const onboardbaseCommandExistinRCFile =
        existDataArray.includes('# onboardbase');

      /**
       * only update the user's RC file again if the onboardbase command doesnt already
       * exist in the user's RC file
       */
      if (!onboardbaseCommandExistinRCFile) {
        const command = `${existingData}\n\n# onboardbase\nonboardbase config:set --re-authenticate`;
        writeFileSync(shellRC, command);
      }
    }

    const newScope = YAML.stringify(finalData);
    writeFileSync(this.onboardbaseConfigFile, newScope);
  }

  async deleteOnboardbaseConfigs() {
    rimraf.sync(this.onboardbaseDirectory);
    console.log(chalk.green('onboardbase artifacts deleted successfully...'));
    process.nextTick(process.exit(1));
  }

  getHttpInstance(url = null) {
    const allConfigs = this.getConfigs();
    const instance: any = axios.create({
      baseURL: url
        ? url
        : allConfigs[this.cwd]?.['api-host'] ??
          allConfigs['/']?.['api-host'] ??
          'https://api.onboardbase.com/graphql',
    });

    return instance;
  }
}

export default new ConfigManager();
