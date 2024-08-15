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

export const prompt = `
Given the specified event about a Kubernetes object, render output based on the following TypeScript type.
The "watchEvent" field will be one of "Deleted", "Modified", or "Added" and represents the type of event that occurred.

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
`;
