import * as vscode from 'vscode';
import ConfigManager from '../config';
import { generateRsaKeys } from '../utils/authentication';

export const revokeAuthToken = async (token: string) => {
  const instance = ConfigManager.getHttpInstance();
  try {
    const query = `mutation {
      revokeAuthToken(token: "${token}") {
        status
        message
      }
    }
    `;
    const { data } = await instance.post('', { query });
    return data?.data?.revokeAuthToken;
  } catch (error) {
    //console.log(chalk.bold.red("Could not revoke auth token"));
    console.error(error);
    vscode.window.showErrorMessage('Could not revoke auth token');
  }
};

export const generateAccessToken = async (authToken: string) => {
  const instance = ConfigManager.getHttpInstance();
  const { publicKey, privateKey } = generateRsaKeys();
  ConfigManager.storeRsaKeys(publicKey, privateKey);

  const query = `mutation {
    authenticateToken(token: "${authToken}", frontendPublicKey: ${JSON.stringify(
    publicKey,
  )}) {
      backendPublicKey
      accessToken
      authToken {
        serviceName

        project {
          title
          id
        }
        environment {
          title
          id
        }
      }
      user {
        email
        id
        name
        teams {
          userTeamRole {
            name
        }
      }
      }
    }
  }`;
  const { data } = await instance.post('', { query });
  if (data.errors) {
    throw new Error('An error occured. Pls try again.');
  }
  ConfigManager.storeBackendPublicKey(
    data?.data?.authenticateToken?.backendPublicKey,
  );
  return data?.data?.authenticateToken;
};

export const fetchProjects = async (
  accessToken: string,
): Promise<
  {
    id: string;
    title: string;
    member: boolean;
    environments: {
      list: { title: string; id: string; member: boolean }[];
    };
  }[]
> => {
  const instance = ConfigManager.getHttpInstance();
  instance.defaults.headers['Authorization'] = `Bearer ${accessToken}`;

  const query = `query {
    generalProjects(filterOptions: { fromCli: true}) {
      list {
        id
        title
        member
        environments {
          list {
            title
            id
            member
          }
        }
      }
    }
  }`;

  const { data } = await instance.post('', { query });
  if (data.errors) {
    throw new Error(`There was an error fetching a list of your projects... Please run 
        "onboardbase login" again to be sure you have access to this organization.`);
  }
  return data.data.generalProjects.list;
};

export const fetchSecrets = async (
  project: string,
  environment: string,
  accessToken: string,
) => {
  const instance = ConfigManager.getHttpInstance();
  instance.defaults.headers['Authorization'] = `Bearer ${accessToken}`;
  const query = `query {
    generalProjects(filterOptions: { title: "${project}", fromCli: true}) {
      totalCount
      list {
        id
        title
        team {
          id
          name
        }
        environments(
          take: 10
          skip: 0
          filterOptions: { title: "${environment}", fromCli: true}
        ) {
          list {
            id
            key
            title
            member
          }
        }
      }
    }
  }
  `;

  const { data } = await instance.post('', { query });
  if (data.errors && data.errors[0].message === 'Unauthorized') {
    throw new Error(
      "Sorry you don't have access to this project environment any longer, please contact admin",
    );
  }

  return data;
};

export const updateEnvironment = async (
  accessToken: string,
  environmentId: string,
  secrets: any,
): Promise<void> => {
  const instance = ConfigManager.getHttpInstance();
  instance.defaults.headers['Authorization'] = `Bearer ${accessToken}`;

  const query = `mutation {
    updateEnvironment(
      updateEnvironmentInput: { key: ${JSON.stringify(`[${secrets}]`)}}
      environmentId: "${environmentId}"
    ) {
      id
      title
    }
  }`;

  const { data } = await instance.post('', { query });
  if (data.errors) throw new Error(data.errors[0].message);
};

export const generateAuthCode = async (
  fingerprint: string,
  hostOS: string,
  hostName: string,
  hostARCH: string,
): Promise<{ authCode: string; pollingCode: string }> => {
  const instance = ConfigManager.getHttpInstance();
  const query = `mutation {
    addAuthCode(addAuthCodeInput: {fingerprint: "${fingerprint}", hostOS: "${hostOS}", hostName: "${hostName}", hostARCH: "${hostARCH}"}) {
      pollingCode
      authCode
      hostOS
      hostName
      hostARCH
    }
  }`;

  const { data } = await instance.post('', { query });
  if (data.errors) {
    throw new Error(data.errors[0].message);
  }

  return data?.data?.addAuthCode;
};

export const getAuthToken = async (pollingCode: string): Promise<any> => {
  const instance = ConfigManager.getHttpInstance();
  const query = `query {
    verifyAuthCode(pollingCode: "${pollingCode}") {
      id
      token
    }
  }`;

  const currentApiHost = instance.defaults.baseURL;
  try {
    ConfigManager.setAuthApiHost(currentApiHost);
    const { data } = await instance.post('', { query });
    return data;
  } catch (err) {
    console.log(err);
  }
};

export const signup = async (data: {
  email: string;
  name: string;
  teamName: string;
  authCode: string;
}) => {
  const instance = ConfigManager.getHttpInstance();
  const query = `mutation {
  signup(registrationInput: {email: "${data.email}", teamName: "${data.teamName}", name: "${data.name}", cliSignUpAuthCode: "${data.authCode}"}) {
    backendPublicKey
  }
}`;

  try {
    const { data } = await instance.post('', { query });
    if (data.errors) {
      throw new Error(data.errors[0].message);
    }
    return data;
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

export const createProject = async (
  accessToken: string,
  title: string,
  description: string,
  environment?: string,
): Promise<void> => {
  const instance = ConfigManager.getHttpInstance();
  instance.defaults.headers['Authorization'] = `Bearer ${accessToken}`;

  const query = `mutation {
    addProject(
      addProjectInput: {
        title: "${title}"
        ${description ? `description: "${description}"` : ''}
        ${environment ? `environment: "${environment}"` : ''}
        type: "api_keys"
      }
    ) {
      id
    }
  }
  `;

  try {
    const { data } = await instance.post('', { query });
    if (data.errors) throw new Error(data.errors[0].message);
  } catch (error) {
    if (error.response.data) console.error(error.response.data);
  }
};

export const getTeamMateByCode = async (code: string): Promise<string> => {
  const instance = ConfigManager.getHttpInstance();
  const query = `query {
  newEmployee(confirmationCode: "${code}") {
    id
    teamName
  }
}`;

  try {
    const { data } = await instance.post("", { query });
    if (data.errors) {
      throw new Error(data.errors[0].message);
    }
    return data.data.newEmployee.id;
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

export const teamMateSignup = async (data: {
  name: string;
  userId: string;
}) => {
  const instance = ConfigManager.getHttpInstance();
  const query = `mutation {
  setupNewEmployeeProfile(id: "${data.userId}", userInput: {name: "${data.name}"}) {
    accessToken
  }
}`;

  try {
    const { data } = await instance.post("", { query });
    if (data.errors) {
      throw new Error(data.errors[0].message);
    }
    return data;
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};