export const config = {
  configVersion: 'v1',
  kubernetes: [
    {
      apiVersion: 'v1',
      kind: 'Pod',
      executeHookOnSynchronization: false,
      executeHookOnEvent: ['Added', 'Modified', 'Deleted'],
    },
  ],
};