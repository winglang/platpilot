import fs from 'fs/promises';
import { OpenAI } from 'openai';
import { config } from './config';
import { prompt } from './prompts';
import { getOrCreateSlackThread } from './slack';
import { reasonApplication } from './argo';

export type BindingContext = {
  watchEvent: 'Deleted' | 'Modified' | 'Added';
  object: ApiObject;
};

export type ApiObject = {
  apiVersion: string;
  kind: string;
  status?: any;
  metadata: {
    name: string;
    namespace?: string;
    creationTimestamp?: string;
    generation?: number;
    resourceVersion?: string;

    uid?: string;
    annotations?: Record<string, string>;
    labels?: Record<string, string>;
    managedFields?: any[];
  };
};

const channel = process.env.SLACK_CHANNEL!;
if (!channel) {
  throw new Error('SLACK_CHANNEL is not set');
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error('OPENAI_API_KEY is not set');
}

const ghToken = process.env.GITHUB_TOKEN;
if (!ghToken) {
  throw new Error('GITHUB_TOKEN is not set');
}

const client = new OpenAI({ apiKey });

async function main() {
  if (process.argv[2] === '--config') {
    console.log(JSON.stringify(config, undefined, 2));
    process.exit(0);
  }

  const contextPath = process.env.BINDING_CONTEXT_PATH;
  if (!contextPath) {
    throw new Error('BINDING_CONTEXT_PATH is not set');
  }

  const events = extractEvents(JSON.parse(await fs.readFile(contextPath, 'utf-8')));

  for (const event of events) {
    const uid = event.object.metadata.uid!;

    const name = `*${event.object.apiVersion}/${event.object.kind}* ${event.object.metadata.namespace ?? 'Default'}/${event.object.metadata.name}`;

    const emoji = (() => {
      switch (event.watchEvent) {
        case 'Added': return '🌟';
        case 'Deleted': return '🗑️';
        case 'Modified': return '✏️';
      }
    })();

    console.log(`${emoji} ${event.watchEvent}: ${name} (uid=${event.object.metadata.uid}`);

    const thread = await getOrCreateSlackThread(uid, channel, [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: name,
      },
    }]);

    // await thread.update(`${name}: ${emoji} ${event.watchEvent}`);
    let content: string | null = null;
    if (event.object.apiVersion === 'argoproj.io/v1alpha1' && event.object.kind === 'Application') {
      content = await reasonApplication(client, ghToken!, event.object);
    } else {
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 2048,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: JSON.stringify({ event }) },
        ],
      });
      content = response.choices[0].message.content;
    }
    if (content) {
      try {
        const body = JSON.parse(content);
        await thread.update(`${body.icon} ${name}: ${body.status}`);
        if (body.details?.blocks) {
          await thread.postBlocks(body.details.blocks);
        }
      } catch (e) {
        console.error(e);
        console.error(content);
      }
    }
  }
}

function extractEvents(context: any): BindingContext[] {
  const results = [];
  for (const ctx of context) {
    if ('objects' in ctx) {
      for (const ctx2 of ctx.objects) {
        // copy from parent so we can reason about it.
        ctx2.type = ctx.type;
        ctx2.watchEvent = ctx.watchEvent;
        results.push(ctx2);
      }
    } else if ('object' in ctx) {
      results.push(ctx);
    }
  }

  return results;
}

main().catch(e => {
  console.error(e.stack);
  process.exit(1);
});