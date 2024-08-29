export const config = {
  configVersion: 'v1',
  kubernetes: [
    {
      apiVersion: 'v1',
      kind: 'Pod',
      executeHookOnSynchronization: false,
      executeHookOnEvent: ['Added', 'Modified', 'Deleted'],
    },
    {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      executeHookOnEvent: ['Added', 'Modified', 'Deleted'],
    },
  ],
};