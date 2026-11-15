/**
 * @format
 */

import React from 'react';
import {it, expect} from '@jest/globals';

it('app module exports a component', () => {
  // Avoid mounting native Navigation/TTS modules in Jest.
  const App = require('../App').default;
  expect(typeof App).toBe('function');
});
