import ConfigManager from '../config';
import { BaseAddSecretInput, TAddSecretInput, TFetchSecrets } from './response.types';

export const retrieveSecrets = async (
  environmentId: string,
  accessToken: string,
): Promise<TFetchSecrets> => {
  const instance = ConfigManager.getHttpInstance();
  instance.defaults.headers['Authorization'] = `Bearer ${accessToken}`;
  const query = `query {
  generalSecrets(filterInput: {environmentId: "${environmentId}"}) {
    totalCount, 
     list {
      key
      value
      id
      title
       project {
        member
        id
        title
      }
  }
  }}`;

  const { data } = await instance.post('', { query });
  if (data.errors && data.errors[0].message === 'Unauthorized') {
    throw new Error(
      "Sorry you don't have access to this project environment any longer, please contact admin",
    );
  }
  return data.data.generalSecrets;
};

export const addMergeRequest = async (
  secret: BaseAddSecretInput,
  meta: { accessToken: string; environmentId: string; comment?: string },
) => {
  const query = `mutation addMergeRequest ($addSecretsInput: [BaseAddSecretInput!]) {
  addMergeRequest(addMergeRequestInput: { environmentId: "${meta.environmentId}", comment: "${meta.comment}", secrets: $addSecretsInput }) {
    comment
  }
}`;

  const variables = {
    addSecretsInput: [secret],
  };
  const instance = ConfigManager.getHttpInstance();
  instance.defaults.headers['Authorization'] = `Bearer ${meta.accessToken}`;

  const { data } = await instance.post('', { query, variables });
  if (data.errors && data.errors[0].message === 'Unauthorized') {
    throw new Error(
      "Sorry you don't have access to this project environment any longer, please contact admin",
    );
  }
  return data;
};

export const addSecrets = async (
  accessToken: string,
  secrets: TAddSecretInput[],
) => {
  const query = `mutation addSecret ($addSecretsInput: [AddSecretInput!]!) {
  addSecrets(addSecretsInput: $addSecretsInput) {
    id
    key
    value
    url
  }
}`;

  const variables = { addSecretsInput: secrets };

  const instance = ConfigManager.getHttpInstance();
  instance.defaults.headers['Authorization'] = `Bearer ${accessToken}`;

  const { data } = await instance.post('', { query, variables });
  if (data.errors && data.errors[0].message === 'Unauthorized') {
    throw new Error(
      "Sorry you don't have access to this project environment any longer, please contact admin",
    );
  }
  return data;
};
