import {assert} from 'chai';

import '../src/dbp-check-in-request';
import '../src/dbp-check-in.js';

suite('dbp-check-in-request basics', () => {
  let node;

  suiteSetup(async () => {
    node = document.createElement('dbp-check-in-request');
    document.body.appendChild(node);
    await node.updateComplete;
  });

  suiteTeardown(() => {
    node.remove();
  });

  test('should render', () => {
    assert(node.shadowRoot !== undefined);
  });
});

suite('dbp-check-in-app basics', () => {
  let node;

  suiteSetup(async () => {
    node = document.createElement('dbp-app');
    document.body.appendChild(node);
    await node.updateComplete;
  });

  suiteTeardown(() => {
    node.remove();
  });

  test('should render', () => {
    assert(node.shadowRoot !== undefined);
  });
});

