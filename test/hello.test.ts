import { Hello } from '../src';
import { namespaceLogs } from '../src/argo';

test('hello', () => {
  expect(namespaceLogs('default')).toBe('hello, world!');
  expect(new Hello().sayHello()).toBe('hello, world!');
});