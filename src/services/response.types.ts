export interface TFetchSecrets {
  totalCount: number;
  list: SecretModel[];
}

type SecretModel = {
  id: string;
  key: string;
  keySha: string;
  urlSha: string;
  value: string;
  url: string;
  username: string;
  password: string;
  comment: string;
  title: string;
  parent: SecretModel;
  //FIXME add type
  user: any;
  project: ProjectModel;
};

export interface ProjectModel {
  id: string;
  title: string;
  description: string;
  member: string;
  username: string;
  url: string[];
  password: string;
  document: string;
  key: string;
  value: string;
}

export interface TAddSecretInput {
  key: string;
  value: string;
  title?: string;
  username?: string;
  password?: string;
  url?: string;
  comment?: string;
  environmentId: string;
  mergeRequestId?: string;
  parent?: string;
}
