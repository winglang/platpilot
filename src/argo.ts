import stream from 'stream';
import * as k8s from '@kubernetes/client-node';
import { type OpenAI } from 'openai';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const prompt = (app: any, commit: string, logs: string, appLogs: string[]) => `
Provide detailed explanation about the ArgoCD application (see end of the prompt). render output based on the following TypeScript type.:

export type Response = {
  /**
   * An emoji representing the status of the Kubernetes object.
   */
  icon: string;

  /**
   * A single word representing the status of the Kubernetes object.
   */
  status: string;

  /**
   * Failure analysis details details about the status of the Kubernetes object. This field should only be included in case the
   * object has failed or is has an error (not if it is in a healthy or pending or any other state that doesnt require user action).
   */
  details?: {
    /**
     * A JSON array of Slack blocks with markdown text.
     * Start with a single sentence describing the event that occurred and follow it with additional details about the event.
     * Do not exceed more than two paragraphs of text.
     */
    blocks: Array<{
      type: 'section';
      text: {
        type: 'mrkdwn';
        text: string;
      };
    }>;
  };
}

You are given the following information:
- The ArgoCD application manifest.
- The latest commit detail that is connected to the application.
- Recent logs from the argocd application controller. Those are argocd system logs.
- Recent logs from the pods in the actual application namespace. Those are the user application logs.

The ArgoCD application manifest is:
${JSON.stringify(app)}

The latest commit detail that is connected to the application is:
${JSON.stringify(commit)}

The recent logs from the argocd application controller are:
${logs}

The recent logs from the pods in the actual application namespace are:
${appLogs}
`;

export const getCommit = async (token: string, owner: string, repo: string, ref: string) => {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${ref}`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `token ${token}`,
    },
  });
  if (res.ok) {
    return JSON.stringify(res.json());
  } else {
    return `Failed to fetch commit: ${res.statusText}`;
  }
};

export const podLogs = async (namespace: string, name: string) => {
  const logs: string[] = [];
  const log = new k8s.Log(kc);
  return new Promise(async (res) => {
    const logStream = new stream.PassThrough();
    logStream.on('data', (chunk) => {
      logs.push(chunk);
    });
    logStream.on('end', () => {
      res(logs.join('\n'));
    });
    await log.log(namespace, name, '', logStream, {
      follow: false,
      sinceSeconds: 300,
    });
  });
};

export const namespaceLogs = async (namespace: string) => {
  const logs: string[] = [];
  const api = kc.makeApiClient(k8s.CoreV1Api);
  const pods = await api.listNamespacedPod(namespace);
  for (const pod of pods.body.items) {
    if (pod?.status?.phase === 'Succeeded') {
      continue;
    }
    logs.push('Logs for pod ' + pod?.metadata?.name);
    logs.push(await exports.podLogs(namespace, pod?.metadata?.name));
  }
  return logs;
};

export const reasonApplication = async (client: OpenAI, token: string, ctx: any) => {
  const logs = ''; //await podLogs("argocd", "argocd-application-controller-0");
  const appLogs = await namespaceLogs(ctx.spec.destination.namespace);
  const commit = await getCommit(token, ctx.spec.source.repoURL.split('/')[3], ctx.spec.source.repoURL.split('/')[4], ctx.spec.source.targetRevision);
  const input = prompt(ctx, commit, logs, appLogs);

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2048,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: input },
    ],
  });

  const content = response.choices[0].message.content;
  return content;
};
