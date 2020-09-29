import {assert} from 'chai';

import '../src/dbp-authentic-image-request';
import '../src/dbp-authentic-document.js';

suite('dbp-authentic-image-request basics', () => {
  let node;

  suiteSetup(async () => {
    node = document.createElement('dbp-authentic-image-request');
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

suite('dbp-authentic-document-app basics', () => {
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

